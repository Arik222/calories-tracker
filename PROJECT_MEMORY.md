# Calories Tracker — current project handoff

Updated: 2026-10-29. Based on local source inspection; production database settings and deployment status have not been verified.

## Product and architecture

A live Hebrew RTL calorie tracker used daily. Vanilla HTML, CSS and JavaScript live together in `index.html`; no frontend build step. Supabase supplies Auth and Postgres directly from the browser. Chart.js and Supabase JS load from CDN; Heebo loads from Google Fonts.

`www/index.html` is currently identical to the root app. Capacitor uses `www` as its web directory, but Android is configured to load https://calories-tracker-kappa.vercel.app remotely. Native MainActivity extends BridgeActivity without custom logic.

Git repository: Arik222/calories-tracker. Earlier handoff describes Vercel auto-deployment on pushes to main; verify the remote configuration before relying on it. `vercel.json` defines CSP and other security headers. No deployment was performed during this handoff.

## Current behavior

- Email/password registration with confirmation and Google OAuth. Startup validates identity with `auth.getUser()`; auth events handle sign-in/out.
- Signup metadata includes optional personal details and terms acceptance. A consent gate requires acceptance of the current terms version (`2026-04-16`).
- Food catalog, custom foods, categories, search, quantities and exercise tracking.
- Balance = target − consumed + burned. Totals round after summation.
- Active date belongs to the user, independent of the clock. Finalizing advances exactly one day after the motivational dialog.
- Save writes selected food/exercise entries, removes unchecked saved entries and recalculates the daily summary. Finalize derives the summary from stored entries, not unsaved screen values.
- Graphs show completed summaries. Range buttons take the last 7/30 recorded days or all records, not necessarily consecutive calendar days. Summary includes the existing calorie-to-kg conversion.
- Target history applies targets by effective date. Target changes save separately after an 800 ms delay.
- Editing a food's name or calorie value applies to all historical entries for that user. Calorie edits recalculate affected summaries and currently mark them completed.
- Removing food with × queues deletion until Save: deletes entries from the active date forward and records visibility from that date. Custom foods are also removed from the personal catalog.
- Category expansion is persisted per user. Settings include personal details and account deletion. Profile timestamps and milestone fields exist; milestone dialogs are implemented, but their invocation should be checked before assuming they appear.

## Data and security

Tables referenced by current app: profiles, daily_food_entries, daily_exercise_entries, daily_summaries, user_tracking_state, calorie_target_history, user_custom_foods, user_category_state, user_food_visibility, user_terms_consents.

Public Supabase URL and publishable key in the browser are intentional. User isolation depends on database RLS. Local SQL describes policies but does not prove production state.

`delete_my_account()` deletes the caller's data and auth row; newer tables rely on cascading foreign keys. Consent RPC was introduced then removed by later migrations. Do not rerun migration files indiscriminately.

SQL files do not form a complete reproducible schema: definitions for some later tables/columns and numeric calorie type changes are missing. Inspect actual schema before database work.

## October 29 maintenance changes (local, not deployed)

- Daily save queries and summary reads/writes reject Supabase errors instead of silently ignoring them.
- Failed saving displays a Hebrew warning, restores the Save button and keeps a retry flag. No success indication on failure.
- Saving before date changes, sign-out or finalization must succeed before continuing.
- Tracking-date persistence is checked before changing the in-memory date.
- Parallel save operations settle before a retry is allowed. Affected summary dates remain queued if deletion/recalculation fails.
- Pending removals trigger unsaved-change detection.
- Root and www app copies remain identical.

Writes are still multiple requests, not a database transaction. Partial success is possible; the error message states this. This patch does not harden every other app write path.

## Tests and local work

- Existing QUnit suite: `tests.html`. Includes isolated copies of helper logic and source-pattern checks, so it does not prove end-to-end database behavior.
- Existing runner: serve the root on port 8080, then `node run-tests.js` (Playwright/Chromium required; QUnit loads over the network).
- CI: `.github/workflows/tests.yml`, runs on main pushes and PRs. `npm test` is still a placeholder.
- New local regression checks: `node tests/save-errors.cjs`; executes the actual action functions with simulated failures, checks navigation/sign-out/finalization abort, button recovery, parallel settling, success feedback and app-copy equality.
- `backup.js` is an unfinished script with placeholder credentials, incomplete table coverage and ESM imports in a CommonJS project. It does not establish that backups are running. Never place a service-role key in browser files.
- `config.js` is a legacy unused config; retained.
- Android plans are historical task-specific instructions, not evidence the builds were completed.
- Pre-existing local changes: package.json/package-lock.json modified; .claude, Android plans, android, backup.js and pictures untracked. Preserve them.

## Remaining known concerns

- Separate target autosave, inline historical edits, reset-day and several startup/read paths still need systematic error handling.
- recalcSummaryForDate uses the visible target even when invoked for a different date during propagated deletion.
- Default-catalog edits persist in historical entries but only change the built-in catalog in memory.
- Settings populate stored kg/cm directly even when the selected display units are lb/inch.
- New-user real-today helper uses UTC; near local midnight it can differ from the local date.
- Client-only multi-request writes can partially succeed and concurrent devices can overwrite changes.

The old edit-button handler conflict described in the March handoff is already fixed: createFoodRow uses onclick consistently. SECURITY_OVERVIEW.md is historical and includes outdated claims (getSession on startup, exactly three empty innerHTML assignments, complete schema/RLS coverage); use current code and actual database inspection as authority.
