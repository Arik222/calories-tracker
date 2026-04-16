# Security Overview — Calorie Tracker

Intended audience: experienced engineer performing a security review.  
Last updated: April 2026

---

## 1. System Architecture (Security Perspective)

### Data flow

```
Browser (index.html)
  │
  ├── Supabase JS SDK (CDN: cdn.jsdelivr.net)
  │     └── HTTPS → Supabase REST / Auth API
  │                  (xvvubmznbmzakpnayovs.supabase.co)
  │
  └── Google Fonts (fonts.googleapis.com / fonts.gstatic.com)
```

### Trust boundaries

| Boundary | Trust level | Notes |
|----------|-------------|-------|
| Browser ↔ Supabase | Untrusted client | All DB writes carry the user's JWT; RLS enforces isolation at DB layer |
| Supabase Auth | Trusted authority | Issues and validates JWTs; `auth.uid()` is derived from the verified JWT, not from client payload |
| Vercel edge | Trusted host | Serves static assets over HTTPS; applies security headers via `vercel.json` |
| Android wrapper (Capacitor) | Same as browser | Loads the app from the Vercel URL; no native code touches data |

### Why there is no custom backend

The app intentionally has no intermediary server. All data access is mediated by Supabase's Row Level Security policies, which enforce user isolation at the database layer. This eliminates a class of backend vulnerabilities (SSRF, server-side injection, misconfigured middleware) at the cost of requiring correct RLS policy authorship — which is auditable directly in the Supabase dashboard.

---

## 2. Authentication & Authorization

### Authentication mechanism

- **Provider:** Supabase Auth (email/password + Google OAuth)
- **Session storage:** Supabase JS SDK stores the session JWT in `localStorage`
- **Session recovery:** `db.auth.getSession()` is called on page load; `onAuthStateChange` handles token refresh and sign-out events
- **User identity in JS:** `currentUser` is assigned exclusively from `db.auth.getUser()` or the `onAuthStateChange` callback — never from DOM input or URL parameters

### How authorization flows

1. Browser sends every Supabase request with `Authorization: Bearer <JWT>` (handled automatically by the SDK)
2. Supabase verifies the JWT signature using its own secret
3. The verified `auth.uid()` is available to RLS policies server-side
4. RLS policies compare `auth.uid()` to the `user_id` column — matching rows are accessible; non-matching rows are invisible

A client cannot forge `auth.uid()` without compromising the Supabase JWT secret.

---

## 3. Data Access Control

### RLS status

Row Level Security is enabled on every user-data table. No table is accessible without a valid authenticated session.

### Per-table policy summary

| Table | Operations | Policy condition |
|-------|-----------|-----------------|
| `profiles` | SELECT, INSERT, UPDATE | `auth.uid() = id` |
| `daily_food_entries` | SELECT, INSERT, UPDATE, DELETE | `auth.uid() = user_id` |
| `user_tracking_state` | SELECT, INSERT, UPDATE | `auth.uid() = user_id` |
| `daily_summaries` | SELECT, INSERT, UPDATE | `auth.uid() = user_id` |
| `user_custom_foods` | SELECT, INSERT, UPDATE, DELETE | `auth.uid() = user_id` |
| `calorie_target_history` | SELECT, INSERT, UPDATE | `auth.uid() = user_id` |
| `daily_exercise_entries` | SELECT, INSERT, UPDATE, DELETE | `auth.uid() = user_id` |
| `user_category_state` | SELECT, INSERT, UPDATE, DELETE | `auth.uid() = user_id` |
| `user_food_visibility` | SELECT, INSERT, UPDATE, DELETE | `auth.uid() = user_id` |

### Critical property

**A client cannot bypass RLS.** The anon key grants only the ability to call the Supabase API as an unauthenticated or authenticated user. RLS policies are enforced by Postgres itself after the JWT is verified — they run inside the database engine, not in application code. Even if client-side JavaScript is fully compromised, an attacker cannot read or write another user's rows.

### RPC functions

One stored procedure is used: `delete_my_account()`.

- Defined with `SECURITY DEFINER` to reach `auth.users`
- Scoped to the calling user via `auth.uid()` inside the function body
- Deletes the user's own rows via cascading foreign keys, then calls `auth.admin.deleteUser` on the server side
- Cannot be called to delete another user's data

---

## 4. Client-Side Security

### DOM manipulation approach

The app is a single HTML file with approximately 2,600 lines of vanilla JavaScript. All dynamic DOM construction uses the safe DOM API pattern:

```js
// All user data reaches the DOM through textContent or .value — never innerHTML
label.textContent = food.name;          // food name from DB
badge.textContent = cal + ' קל׳';      // calorie value
document.getElementById('userEmail').textContent = currentUser.email;
```

### innerHTML usage

`innerHTML` is used in exactly three places, all assigning the empty string `''` to clear a container before repopulating it via `appendChild()`. No user-supplied data is ever interpolated into an HTML string.

### XSS risk assessment

- **Stored XSS:** Not viable. User data (food names, calorie values, emails) is always rendered via `textContent`, which the browser treats as plain text and never parses as HTML.
- **Reflected XSS:** Not applicable. The app has no URL parameters that are rendered into the DOM.
- **DOM-based XSS:** Not viable for the same reason as stored XSS — there is no code path that passes user-controlled data to an HTML-interpreting sink.

---

## 5. Content Security Policy

### Current CSP (applied via `vercel.json` HTTP response header)

```
default-src 'self';
script-src  'self' 'unsafe-inline' https://cdn.jsdelivr.net;
connect-src 'self' https://*.supabase.co https://cdn.jsdelivr.net;
img-src     'self' data:;
style-src   'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src    https://fonts.gstatic.com;
```

Plus the following headers on every response:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`

### Why `'unsafe-inline'` is required

The entire application — approximately 2,600 lines of JavaScript and all CSS — lives in a single `index.html` file. There are no external `.js` or `.css` files to reference with `'self'`. Enforcing `script-src` without `'unsafe-inline'` would require computing and embedding a SHA-256 hash of the entire script block, which would need to be recomputed on every code change. This is impractical for the current single-file architecture.

### What CSP still protects despite `'unsafe-inline'`

| Protection | Mechanism |
|-----------|-----------|
| Data exfiltration | `connect-src` restricts outbound fetch/XHR/WebSocket to Supabase and cdn.jsdelivr.net only. Even if an attacker injected a script, they cannot POST data to an arbitrary external host. |
| Script injection from external hosts | `script-src` blocks loading scripts from any domain other than `cdn.jsdelivr.net`. |
| Clickjacking | `X-Frame-Options: DENY` prevents the app from being embedded in an iframe. |
| MIME-type confusion | `X-Content-Type-Options: nosniff` prevents browsers from MIME-sniffing responses. |
| Referrer leakage | `Referrer-Policy: no-referrer` suppresses the `Referer` header on all outgoing requests. |

### Known CSP limitations

- `'unsafe-inline'` on `script-src` means an injected inline script would not be blocked by CSP. The defense against XSS is therefore the DOM API discipline described in Section 4, not CSP.
- The current architecture makes it impossible to eliminate `'unsafe-inline'` without restructuring the app into separate JS files.

---

## 6. Network Security

- **HTTPS:** Enforced by Vercel for all responses. There is no HTTP fallback.
- **Supabase transport:** All Supabase SDK calls use HTTPS. The Supabase URL is `https://xvvubmznbmzakpnayovs.supabase.co`.
- **Outbound connections (browser):** Restricted by `connect-src` to `*.supabase.co` and `cdn.jsdelivr.net`. The app cannot make fetch/XHR requests to arbitrary hosts.
- **Android wrapper:** Capacitor loads the app from the Vercel HTTPS URL (`server.url` in `capacitor.config.json`). No local assets are served; the Android WebView behaves identically to the browser. `cleartext` traffic is not permitted.

---

## 7. Secrets & Keys

### Client-side key

```js
const SUPABASE_KEY = 'sb_publishable_...';
```

This is the Supabase **publishable anon key**. Its prefix (`sb_publishable_`) confirms it is the public key intended for client-side use. It is safe to expose in source code.

**The `service_role` key is not present anywhere in this codebase.** The `service_role` key would bypass RLS entirely; using it client-side would be a critical vulnerability. It is used only server-side within Supabase's own infrastructure (e.g., Auth admin operations called by the `delete_my_account` RPC).

### Key capabilities

| Key | Location | Can bypass RLS? | Risk if exposed |
|-----|----------|----------------|----------------|
| `anon` / publishable | `index.html` (public) | No — RLS still enforced | None beyond what RLS permits |
| `service_role` | Supabase server only | Yes — full DB access | Critical — not used client-side |

---

## Summary

The primary security model of this app is:

1. **Identity** is established by Supabase Auth (JWT)
2. **Isolation** is enforced by Postgres RLS using `auth.uid()` — this is the authoritative control, not the frontend
3. **XSS** is mitigated by DOM API discipline (`textContent` everywhere), not by CSP
4. **CSP** provides defense-in-depth against data exfiltration even if an XSS vector were found
5. **No secrets** are exposed client-side

The main architectural risk is inherent to the serverless/BaaS model: correctness of RLS policies is critical. A missing or incorrect policy on any table would allow cross-user data access. Policy correctness should be verified directly in Supabase.
