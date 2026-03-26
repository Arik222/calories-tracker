# PROJECT MEMORY — מערכת לניהול קלוריות (Calories Tracker)

Last updated: 2026-03-26

---

## Project Goal

A personal Hebrew calorie tracking web app. Users log daily food and exercise, track a calorie balance, finalize each day, and view a historical graph. Built for real daily use, including mobile.

---

## Architecture

- **Single-file frontend**: everything is in `index.html` (~2234 lines). No build step, no bundler, no npm for the app itself.
- **Backend**: Supabase (hosted Postgres + Auth). RLS enabled on all tables. Client-side only — no server-side code.
- **Deployment**: GitHub → Vercel auto-deploy on push to `main`.
- **Live URL**: `https://calories-tracker-kappa.vercel.app`
- **Fonts**: Google Fonts Heebo (loaded from CDN) for Hebrew typography.
- **Charts**: Chart.js v4 via CDN.
- **Auth**: Supabase email/password. Email confirmation enabled. Uses `db.auth.getUser()` (server round-trip) on init — not `getSession()` — to detect deleted/stale sessions.

---

## File Reference

| File | Purpose |
|------|---------|
| `index.html` | Entire app — HTML, CSS, JS in one file |
| `config.js` | Was the Supabase URL/key config — **now orphaned**. Constants were inlined into `index.html` directly (required for CI security test). Can be deleted safely. |
| `supabase-setup.sql` | Original table creation + RLS policies (`profiles`, `daily_food_entries`) |
| `supabase-history.sql` | Later migrations: `user_tracking_state`, `daily_summaries`, init data |
| `messages_hebrew.txt` | Human-readable export of all 4 motivational message groups (UTF-8, Hebrew) |
| `tests.html` | QUnit browser test suite (~45 assertions across 6 modules) |
| `run-tests.js` | Playwright headless runner for CI — opens tests.html, exits 0/1 |
| `package.json` | Minimal — only declares `playwright` as a dev dep for CI |
| `.github/workflows/tests.yml` | GitHub Actions: runs on every push to main |
| `.gitignore` | Excludes `node_modules/`, `.DS_Store` |

---

## Database Schema (Supabase)

All tables have RLS. Users can only read/write their own rows.

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | = auth.users.id |
| `daily_calorie_target` | integer | default 2300 |
| `height_cm` | numeric | stored in cm regardless of input unit |
| `weight_kg` | numeric | stored in kg regardless of input unit |
| `height_unit` | text | 'cm' or 'inch' (display preference) |
| `weight_unit` | text | 'kg' or 'lb' (display preference) |
| `age` | int | |
| `gender` | text | 'male', 'female', 'other', or null |

### `daily_food_entries`
`id, user_id, date, food_name, calories_per_unit, quantity` — unique on `(user_id, date, food_name)`

### `daily_exercise_entries`
`id, user_id, date, exercise_name, calories_burned, quantity`

### `daily_summaries`
`id, user_id, tracking_date, total_calories, calorie_balance, exercise_burned, status ('open'|'completed')` — unique on `(user_id, tracking_date)` — this is what powers the graph

### `user_tracking_state`
`user_id, current_tracking_date` — one row per user, the currently active tracking day

### `calorie_target_history`
Tracks calorie target changes over time for accurate per-day graph balance calculation.

### `user_custom_foods`
`user_id, food_name, calories_per_unit, unit, category` — user's own custom food entries

### Postgres Function
`delete_my_account()` — security definer, deletes all user data + auth.users row. Called via `db.rpc('delete_my_account')`.

---

## Key JS Functions in index.html

| Function | What it does |
|----------|-------------|
| `init()` | App entry point — calls `db.auth.getUser()`, shows auth or app |
| `loadAndShowApp()` | Loads profile, tracking state, foods, exercise, target, then shows app |
| `loadProfile()` | Fetches `profiles` row; creates it on first login using `user_metadata` from signup |
| `finalizeDay()` | Saves `daily_summaries` row, shows motivation modal, advances active date |
| `showMotivationModal(balance, gender)` | Returns a Promise, shows gender+balance-specific Hebrew message |
| `deleteAccount()` | Calls RPC, local signOut, location.reload() |
| `saveProfileDetails()` | Updates profiles row from settings form (age, gender, weight, height) |
| `populateSettingsFields()` | Called when switching to settings tab — populates form from `currentProfile` |
| `switchTab(tab)` | Switches between מעקב יומי / גרפים / הגדרות |
| `addOneDay(dateStr)` | Timezone-safe date increment (YYYY-MM-DD) |
| `formatDateHebrew(dateStr)` | Converts YYYY-MM-DD → DD/MM/YYYY |
| `updateTotal()` | Recalculates and displays total/burned/balance from current DOM state |

---

## Current Status

Working and deployed. Core features complete:

- ✅ Food tracking (categories, quantities, custom foods)
- ✅ Exercise tracking
- ✅ Daily calorie balance (target - consumed + burned)
- ✅ Finalize day → saves summary → advances to next day
- ✅ Historical graph (Chart.js, balance per day)
- ✅ Motivational popup after finalizing (4 groups: gender × success/failure, 12–13 msgs each)
- ✅ Settings tab: personal details (email, age, gender, weight, height) + account deletion
- ✅ Auth screen: split layout, Heebo font, height/weight/age/gender at signup
- ✅ Mobile responsive header (title stacks above date/email on small screens)
- ✅ Date picker: full button clickable on mobile (transparent overlay technique)
- ✅ QUnit test suite (45 assertions: date utils, balance math, unit conversion, message selection, security scan, DOM logic)
- ✅ GitHub Actions CI (Playwright headless, runs on every push to main)

---

## Known Bugs / Issues

### Edit button (✓) for food rows — NOT YET FIXED
The `✎` edit button on food rows becomes unresponsive after clicking to confirm (`✓`).

**Root cause (identified):** `createFoodRow` adds a permanent `addEventListener('click', () => startEditRow(row))`. In edit mode, `startEditRow` also sets `row._editBtn.onclick = save`. Clicking `✓` fires both handlers — `startEditRow` re-enters edit mode, racing or overriding the save.

**Fix needed:** In `startEditRow`, before setting the save handler, remove the original `addEventListener`. In `cleanup()`, re-add it. Use a named function so it can be removed properly.

---

## Product Decisions Already Made

- `activeTrackingDate` is user-controlled (not clock-based) — intentional, users can track past days
- Balance = target - consumed + burned. Positive = under target (good). Negative = over target (bad).
- Graph only shows **finalized** days (from `daily_summaries`). Open days don't appear.
- `daily_summaries` is the source of truth for the graph — not reconstructed from entries on the fly.
- `delete_my_account()` uses `security definer` + `set search_path = public, auth` to reach auth.users
- Auth uses `getUser()` not `getSession()` — prevents stale sessions after manual user deletion
- Supabase anon key in `index.html` is intentional — it's a publishable key, RLS protects data
- Gender defaults to 'male' message group when null/other (not a bug)
- Motivation popup must be dismissed before date advances (Promise-based modal)
- `config.js` is now orphaned — constants were inlined into `index.html` for the CI security scan

---

## Next Recommended Steps

1. **Fix the edit button bug** (highest priority, known regression)
   - File: `index.html`, functions `createFoodRow` and `startEditRow`
   - Use named handler function + `removeEventListener` before switching to save mode

2. **Delete `config.js`** — it's orphaned, constants are now in `index.html`

3. **Verify CI is green** — check GitHub → Actions tab after next push to confirm all 45 tests pass in headless Chrome

4. **Consider BMR/TDEE calculation** — age, gender, height, weight are now stored in `profiles`; could auto-suggest a calorie target based on them

5. **Password reset flow** — currently users who forget their password must use Supabase dashboard. Could add a "שכחתי סיסמה" link on the auth screen.

---

## Dev Notes

- Run locally: `cd "~/calories project" && python3 -m http.server 8080` → `http://localhost:8080`
- Run tests locally: same server → `http://localhost:8080/tests.html`
- Push to deploy: `git push` triggers Vercel auto-deploy (usually ~30 seconds)
- No package install needed for the app itself — only `npm install` for CI/testing (playwright)
- All SQL migrations must be run manually in Supabase SQL editor after schema changes; remember to run `NOTIFY pgrst, 'reload schema'` after adding columns
