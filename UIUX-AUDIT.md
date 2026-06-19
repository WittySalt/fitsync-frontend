# FitSync Frontend — UI/UX Audit & Codex Work Backlog

> Audited: 2026-06-18. Scope: `frontend/src/**` against `FitSync-Design-Tokens.md`,
> `INTEGRATION.md`, `frontend-design-ai-brief.md`, `frontend.md`, `frontend/memory.md`.
>
> **How to use this file with Codex:** each ticket below is self-contained. Hand one
> ticket at a time. Every ticket assumes the mandatory skill-loading protocol in
> root `AGENTS.md` (read `capstone-development-workflow` + `frontend-ui-engineering`
> first) and the Mandatory Deliverables (loading/error/empty state, validation,
> tests, doc update). Do **not** modify protected files (`package-lock.json`,
> `angular.json` build targets beyond what a ticket explicitly allows) without
> asking. Prefer minimal, localized changes.

---

## Decisions log (ratified 2026-06-18 — treat as binding for Codex)

- **D1 — Charting (FE-4): APPROVED `chart.js` + `ng2-charts`.** Pin exact versions;
  do the install as a **single isolated commit** that also updates the protected
  `package-lock.json` (this commit is the explicit lockfile-change approval — do not
  bundle other changes into it). Wrap usage in a thin `<fs-chart>` component so no
  business component imports `chart.js` directly. Color charts via semantic CSS
  tokens only. If a screen needs exactly one trend line, a token-themed inline-SVG is
  an acceptable zero-dep substitute, but the library is approved for ≥2 chart types.
- **D2 — `angular.json` (FE-1): APPROVED.** Add `src/styles` to
  `stylePreprocessorOptions.includePaths` on the build **and** test targets. Submit
  it as a **standalone, single-line-scope diff** in the FE-1 PR (additive; affects
  SCSS resolution only, not build output or deploy). Do not use long relative `@use`
  paths.
- **D3 — Stack docs (FE-10): RELABEL, do not delete.** Keep the aspirational stack in
  `frontend.md` but physically separate "installed now" from "planned" (see FE-10).
  Reconcile FE-10 **after** FE-4 lands so the chart.js entry becomes accurate.

---

## A. Executive summary

The product has a **complete, well-documented design-token system at the repo root
that is 0% wired into the Angular app.** Components use a parallel, ad-hoc variable
set in `src/styles.scss`, hard-coded hex, inflated font-weights (800/900), no
Fraunces display font, and no dark mode. Closing this gap is the single highest-
leverage UI improvement and is the prerequisite for every other visual ticket.

Page completion (rough):

| Page | Done | Gap |
|---|---|---|
| Login | ~90% | token refactor only |
| Onboarding | ~80% | token refactor, a11y on steppers |
| Settings | ~75% | token refactor, save feedback |
| Dashboard | ~60% | fake conic rings → real charts, token refactor |
| Nutrition | ~55% | food search / timeline / notes are mock; wire APIs |
| Workout | ~30% | live logger / history / catalog all mock; wire APIs, add handlers |
| Progress | ~15% | stub: dead arrays, fake numbers, CSS fake chart, no API/Chart.js |

---

## B. Design-language defects (cross-cutting)

1. **Token system unused.** `fitsync-tokens.css` / `_fitsync-tokens.scss` are never
   imported. `src/styles.scss` defines competing primitives (`--brand-green`,
   `--page-bg`, `--muted`, `--surface-strong`) instead of the semantic layer
   (`--surface`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`,
   `--border`, `--border-strong`).
2. **No Fraunces.** `index.html` has no font links. Spec requires Fraunces (display)
   + Inter (UI). All headings currently render in Inter.
3. **No dark mode.** No `ThemeService`, no `data-theme` attribute, no toggle. The
   token file ships full dark overrides that are unreachable.
4. **Hard-coded hex** in components and `styles.scss` (`#fff`, `#e2e8f0`, `#18231f`,
   `#eef3f0`, `rgba(255,255,255,.84)`) — violates the INTEGRATION.md golden rule.
5. **Font-weight inflation.** Values `650 / 800 / 850 / 900` are used widely; the
   scale only defines `400/500/600/700`. Picks like `900` on body labels hurt
   hierarchy and legibility.
6. **Three icon systems.** `.nav-icon` (mask data-URI), `.fs-icon` (mask data-URI),
   and inline `<svg>` in login. Spec wants one Lucide-based approach.
7. **Eyebrow recipe drift.** Implemented with `letter-spacing:0`; spec is
   `.08em` uppercase `--text-xs` `--fw-semibold` `--accent-text`.
8. **Color drift.** App uses `--blue:#2f80ed`, `--orange:#ef8a24`, `--purple:#7764d8`;
   tokens define `--blue-500:#3b82f6`, `--amber-500:#f59e0b` and no purple primitive.
9. **Radius inconsistency.** Mixed `10/14/16/18px` ad hoc vs the token radius scale.
10. **A11y gaps.** Tab strips use `role="tablist"` but child buttons lack
    `role="tab"`, `aria-selected`, and there is no `role="tabpanel"`/`aria-controls`
    wiring. Decorative bars use `aria-hidden` correctly, but data "charts" expose no
    text alternative.
11. **Mock data shipped as UI.** Workout (`todaySets`, `history`, `catalog`,
    `metrics`), Progress (`points`, hard-coded `26.6` BMI etc.), and parts of
    Nutrition (`mealTimeline`, `nutritionNotes`) are static literals presented as if
    real. These need either real API wiring or an explicit "sample" empty-state.
12. **Stale stack docs.** `frontend.md` still claims Angular Material + Tailwind +
    NgRx + Chart.js; `memory.md` confirms none are installed. Pick one source of
    truth and reconcile.

---

## C. Prioritized Codex tickets

### P0 — FE-1: Wire the FitSync design-token system into the app
**Goal:** make `fitsync-tokens.css` the single source of truth; remove the parallel
variable set. This is largely the canned prompt already in `INTEGRATION.md` §"Codex
prompt", adapted to the real tree.

Tasks:
1. Copy `fitsync-tokens.css` and `_fitsync-tokens.scss` (repo root) into
   `frontend/src/styles/`. Import the CSS **first** in `src/styles.scss`.
2. Add Fraunces + Inter `<link>`s to `src/index.html` `<head>` (`display=swap`).
3. Add `src/styles` to `stylePreprocessorOptions.includePaths` in `angular.json`
   (build + test targets) so components can `@use 'fitsync-tokens' as fs;`.
   **(Approved per D2 — submit as a standalone single-line-scope diff; additive
   only, no long relative `@use` paths.)**
4. In `src/styles.scss`, **delete** the local `:root` primitives that duplicate the
   token layer (`--brand-green*`, `--page-bg`, `--surface-strong`, `--muted*`,
   `--green*`, `--blue/orange/purple`, ad-hoc `--shadow-*`/`--radius*`). Map any
   element-level base styles onto semantic tokens.
5. Keep the shared `.button / .option-card / .segmented / .summary-card` classes but
   re-express them via the provided mixins (`fs.button-primary`, `fs.card`,
   `fs.option-card`, …) or semantic vars only.

Constraints: styling/markup-for-styling only — no logic/routing/Reactive Forms
changes. No new deps. Verify `npm run build` passes.
Acceptance: grep shows **zero** raw hex in `src/app/**/*.scss` and `styles.scss`
(except inside token files); headings render Fraunces.

### P0 — FE-2: ThemeService + dark-mode toggle
Depends on FE-1.
1. Create `core/theme/theme.service.ts`: sets `data-theme` on
   `document.documentElement`, persists to `localStorage` (`fs-theme`), restores on
   app init, falls back to OS `prefers-color-scheme` when unset.
2. Add a sun/moon toggle in the topbar account area (`app.html`), bound to the
   service. Inline Lucide SVG, no icon font.
3. Verify both themes meet AA: 4.5:1 body, 3:1 large/UI; visible focus rings; the
   green primary button uses `--text-on-accent` (near-black in dark).
Tests: unit-test persistence + restore; assert attribute flips.

### P0 — FE-3: Normalize typography & weights
Depends on FE-1. Sweep `src/app/**/*.scss` + `styles.scss`:
- Replace `font-weight` literals with token weights (`400/500/600/700` only).
- Apply the eyebrow recipe (`.08em`, uppercase, `--text-xs`, `--fw-semibold`,
  `--accent-text`) to `.eyebrow`/`.card-label`.
- Replace `clamp()`-based `h1` viewport scaling (brief §13 forbids viewport-width
  font scaling) with the `--text-3xl/4xl` token sizes.

### P1 — FE-4: Real charts for Progress (replace the stub)
The weakest page. Currently dead arrays + fake numbers + CSS bars; no API.
1. Charting: **APPROVED per D1** — add `chart.js` + `ng2-charts`. Pin exact versions.
   Install in a **single isolated commit** that also updates `package-lock.json`
   (that commit is the lockfile-change approval; keep it free of unrelated edits).
   Wrap all usage in a thin `<fs-chart>` component (`shared/`) — no business
   component imports `chart.js` directly. Drive all series/grid colors from semantic
   CSS tokens. (A single trend line may use token-themed inline SVG instead, but the
   library is approved for ≥2 chart types.)
2. Wire `GET /api/v1/users/me/body-metrics` + `/trends` + `/goals` through
   `fitsync-data.service.ts` (follow its existing read-with-graceful-handling
   pattern). Remove hard-coded `26.6 / 21.5% / 42%`.
3. Add loading skeleton, error `app-state-panel`, and a real empty state ("Record
   your first weight"). Add date-range + metric toggle per brief §11.
4. Every chart needs a text alternative (visually-hidden summary table).

### P1 — FE-5: De-mock the Workout page
1. Replace static `todaySets`, `history`, `metrics`, `catalog` with API-backed
   signals (sessions/latest, sessions list, exercises catalog). Where an API is not
   yet available, render an explicit empty state — do not ship fake rows.
2. Wire the dead buttons (`Start session`, `Build plan`, `Add exercise`, `Log set`,
   `Export`, `New custom exercise`) to real handlers or remove them.
3. The "live set logger" `<input value="62.5">` must become a real Reactive Form
   with validation + submit + disabled-while-saving.
4. Add `role="tab"`/`aria-selected`/`tabpanel` wiring to the segmented tabs.
> FE-5 only wired the read GETs. The backend workout API has grown a lot (log a workout, plan
> lifecycle, PRs/per-exercise history, live set logging, library CRUD, repeat, import/export) —
> see **§H (FE-28..FE-34)** for the full integration backlog.

### P1 — FE-6: Finish Nutrition data wiring
1. Replace mock `mealTimeline` and `nutritionNotes` with real meal data (today's
   logged meals) or empty states.
2. Implement real food search (`GET /api/v1/nutrition/foods/search?q=`) with
   debounce, loading, and empty results — currently `foods()` is seeded demo data.
3. Keep the working meal form; add success toast (see FE-8).
> FE-6 is only the seed. The backend nutrition API has grown a lot (search filters, categories,
> recent/favorites, templates, quick-add/copy, micronutrient summary, water, barcode/export) —
> see **§G (FE-20..FE-27)** for the full integration backlog.

### P2 — FE-7: Single Lucide icon system
Consolidate `.nav-icon`, `.fs-icon`, and login inline SVGs into one approach
(tiny `<fs-icon>` wrapper or a shared inline-SVG set) using the spec's recommended
Lucide name→glyph mappings. Remove the duplicated mask CSS.

### P2 — FE-8: Toast/snackbar system
Brief §14 requires success feedback after every mutation. Add a lightweight
signal-based toast service + outlet in `app.html`; replace inline `success-text` /
`saveMessage()` strings across nutrition/settings/onboarding.

### P2 — FE-9: A11y pass
Across all tab strips and interactive cards: `role="tab"`+`aria-selected`+
`aria-controls`, `role="tabpanel"`+`aria-labelledby`; ensure all icon-only buttons
have `aria-label`; verify focus order and visible focus rings post-token-refactor.

### P3 — FE-10: Reconcile stack docs
**Run after FE-4 lands (per D3).** Do **not** delete the aspirational stack — relabel:
1. Add a `## Current actual stack` block at the top of `frontend.md`: Angular 20
   standalone + Router + Reactive Forms + RxJS + SCSS; **chart.js + ng2-charts**
   (added by FE-4); **not installed:** Angular Material, Tailwind, NgRx.
2. Demote the existing target-stack content under a clearly marked
   `## Aspirational / not yet installed` heading.
3. Make the `Current actual stack` block the single authoritative "what is installed"
   source; mirror the decision in `frontend/memory.md` so future codex/AI runs don't
   re-introduce unapproved deps.

---

## D. Suggested execution order
FE-1 → FE-2 → FE-3 (design foundation) → FE-4, FE-5, FE-6 (fill the weak pages) →
FE-7, FE-8, FE-9 (consistency & UX states) → FE-10 (docs).

Ship FE-1..3 as one reviewable "design system adoption" PR; keep each data-wiring
ticket (FE-4/5/6) as its own PR so backend-dependency risk stays isolated.

---

## E. Onboarding & account tickets

Design rationale + the full gap matrix live in `ONBOARDING-ACCOUNT-DESIGN.md`. The
two tickets below are the ratified, prototyped pieces; FE-11/13–18 are summarized at
the end of that doc and can be expanded on demand.

### P1 — FE-12: Goal-driven onboarding (intent + pace + live projection)
Reframe onboarding around the user's goal instead of flat field entry. Prototyped.
1. Insert a **Primary goal** step *first* (Lose fat / Build muscle / Maintain /
   Improve fitness). The choice drives downstream defaults and branching.
2. Rework the anemic Goal step into **target weight + weekly pace** (0.25–1.0 kg/wk,
   `step` 0.05) with a **live projection**: projected date (+week count) and daily
   calorie target recomputed on every input. Replace the hard-coded `-400/+250`
   adjustment in `onboarding.page.ts#estimateCalories`.
3. **Branch:** Maintain / Improve fitness hide target+pace and show an activity
   framing instead.
4. **Health warnings (O9):** if target BMI < 18.5 or pace > 0.75 kg/wk, show a
   non-blocking `--amber-500` warning.
5. **Units-aware inputs (O3):** honor `preferredUnits` — imperial shows ft/in + lb.
6. **Editable plan on Review (O8):** computed calories/macros are overridable.
7. Remove "fake" pre-filled defaults (DOB 1996 / 168 / 72) in favor of empty inputs
   or pickers (O4).

Constraints: Reactive Forms only; wire through `fitsync-data.service.ts` to the
existing `PUT /users/me/profile` + `PUT /users/me/goals/{goalType}` (no new deps).
Include loading/error/empty/success + disabled-while-saving; preserve input on
failed submit. Tests for the projection math + branch logic.
Acceptance: changing pace updates date+calories live; maintain/fitness hides pace;
BMI<18.5 shows the warning; imperial switches unit labels.

### P2 — FE-19: Guided training flow (the "led by the hand" layer)
Implements the Part 4 design language on top of the training/preferences steps.
Prototyped. Build these as reusable pieces, not per-screen:
1. **`<fs-step-rail>`** — named rail (`Goal · Train · Gear · Focus · Schedule ·
   Plan`) with completed/current/upcoming states.
2. **`<fs-coach>`** — reactive second-person copy from a per-step + per-choice map;
   **Voice register A** (see design doc Voice & tone). `--accent-subtle` avatar dot.
3. **`<fs-plan-strip>`** — accumulating chip summary fed by the same signal that
   builds the Review summary.
4. **Where do you train** step: Gym / Home (indoor) / Outdoors / Mixed →
   **branching equipment/activity multi-select** (Gym→barbell/machines…,
   Home→dumbbells/bands/pull-up bar…, Outdoors→running/cycling/calisthenics…).
5. **Focus areas** multi-select (Full body / Upper / Core / Lower / Mobility /
   Cardio).
6. **Schedule** step: days/week + intensity; **skip allowed** on non-essential steps.
7. **Optional O7 — PAR-Q+ readiness step:** 5–7 yes/no toggles + injury flags; any
   "yes" → soft non-blocking notice + "not medical advice" disclaimer.
8. Motion per principle 11 (`--ease-spring` select, 200ms transitions, reduced-motion
   guarded). Tab/step a11y: proper roles + `aria-current`.

**Backend dependency — RESOLVED (do both):** `trainingLocation` exists in
preferences, but **equipment inventory, focus areas, and PAR-Q flags have no backend
field** yet. Ratified plan: **(a) ship FE-19 front-end-first now** so it is not
blocked — capture the data, mark it **session-only** in the UI, and do **not** invent
silent local write-persistence (per `frontend/memory.md` API-client rules); **(b) in
parallel raise BE-1** (below) to add the fields, then switch FE-19 to real
persistence once BE-1 lands.
Acceptance: rail advances with named states; coach copy changes on selection;
choosing Outdoors swaps equipment options; plan strip grows per answer; Review
reflects all selections.

### P1 — FE-11: Profile / Me overview (split `/me` from `/settings`)
Today `/me` and `/settings` both resolve to `SettingsPage` (`app.routes.ts:24-25`) —
there is no real profile surface. Prototyped. Create a dedicated
`features/profile/profile.page.ts` and point `/me` at it; keep `/settings` →
`SettingsPage`.
1. **Identity header:** avatar/initials, display name, membership badge
   (`membershipTier/Status`, read-only), location + joined date, a `share` action and
   a `settings` gear that routes to `/settings`.
2. **Lifetime stats** with a period toggle (This week / Month / All-time): workouts,
   hours trained, calories burned, PRs set. Tabular figures (`tnum`).
3. **Consistency:** current streak + best streak + a 7-day dot row.
4. **Current goal card:** active goal, progress bar, on-track pill, "x to go ·
   projected <date>" — reuse FE-12's projection helper.
5. **Recent activity** (last workout / meal / weigh-in) and an **Achievements** row
   (earned + locked states).
6. **Entry points:** "Edit profile" (into the Settings identity editor) and
   "Settings".

Data: compose existing reads the same way the dashboard does
(`GET /users/me`, `/body-metrics/latest`, `/workouts/sessions/latest`,
`/nutrition/meals/latest`, `/users/me/goals?status=ACTIVE`) via
`fitsync-data.service.ts`; swap to `GET /analytics/dashboard` when available (brief
§16). **Streaks, PRs, lifetime aggregates, and achievements have no endpoint yet** —
gate them behind BE-1; until then render honest empty/"coming soon" states, no fake
totals. Include loading/error/empty states; no new deps.
Acceptance: `/me` renders the profile (not settings); period toggle swaps stats; gear
+ "Settings" route to `/settings`; sections with no backend data show empty states,
never fabricated numbers.

---

## F. Backend tickets raised by frontend design

### BE-1: user-service fields for guided onboarding (scoped to NOT duplicate analytics)
Frontend-driven; needs `api-and-interface-design` + `security-and-hardening` skills.
Adds only the **write/preference data** that user-service genuinely lacks:
1. **Training preferences extension:** `equipmentInventory: string[]`,
   `focusAreas: string[]` (+ enums) on `PUT/GET /users/me/preferences` (training).
2. **Readiness/PAR-Q:** a small `healthReadiness` object (boolean flags +
   `injuryAreas: string[]` + `acknowledgedDisclaimerAt`) on the profile, or a
   dedicated `/users/me/health-readiness` resource. Treat as health data: explicit
   consent, never expose in public profile.

**Profile aggregates are NOT in scope here — they already exist in the analytics
backlog.** FE-11's streak (current/best), goal ETA/projection, PR count, and
achievements map to **AN-1** (nightly streak rollup), **AN-9** (goal ETA forecast),
and **AN-11** (achievements/PR endpoint) in `analytics-service/CODEX-BACKLOG.md`.
FE-11 should consume the analytics dashboard/read APIs, not a new user-service
endpoint. Until those land, FE-11/FE-19 render honest empty/"session-only" states —
no fabricated totals, no silent local write-persistence. Validate payloads,
parameterized queries, authz on every endpoint (root `AGENTS.md` security rules).

---

## G. Nutrition backend integration (backend NU-1..15 shipped — FE must consume)

**Context (2026-06-19).** `nutrition-service` gained a large API surface that the FE does
not yet use. FE-6 (above) is just the seed (basic search + meal form). All endpoints below are
live on `main`, under `/api/v1/nutrition`, JWT-scoped. **Cross-period trends/charts are NOT here —
they belong to `analytics-service`; the Nutrition page should call analytics for history, nutrition
for "today".** Each ticket = its own PR (per the FE-4/5/6 isolation rule).

### P1 — FE-20: Food search upgrade (pagination + filters)
`GET /foods/search` now takes `page,size,categoryId,includeSubcategories,brandId,verified,scope`
and is server-side relevance-ranked. Wire pagination (infinite-scroll or pager) + filter controls.
**Response is a plain array** (no total/hasMore) — infer "more" by `results.length === size`.

### P1 — FE-21: Category browse (e-commerce-style hierarchical filter)
`GET /categories` returns a 2-level tree (`children[]`). Render a group→subcategory picker; tapping
a node filters search by `categoryId` (+ `includeSubcategories=true` for a group).

### P1 — FE-22: Quick-log surfaces (recent / frequent / favorites)
`GET /foods/recent`, `/foods/frequent` (carry last-used serving + macros → one-tap re-log), and
favorites: `POST/DELETE /foods/{foodId}/favorite` + `GET /favorites`. Add a "quick log" rail.

### P1 — FE-23: Saved meals (templates)
`POST /meal-templates` (inline items OR `fromMealId` to snapshot an existing meal), `GET`/`GET/{id}`/
`DELETE /meal-templates`, and one-tap `POST /meals/from-template/{id}` (with `consumedAt`).

### P1 — FE-24: Quick-add + copy
`POST /meals/quick-add` (kcal-only fast entry); copy controls `POST /meals/{id}/copy` and
`POST /days/{date}/copy-to` ("repeat yesterday").

### P1 — FE-25: Daily summary micronutrients + limit flags
`GET /summary/daily` now returns `totalFiberGrams/totalSugarGrams/totalSodiumMg`, the reference
values (`fiberTargetGrams/sugarLimitGrams/sodiumLimitMg`), and flags
(`fiberTargetMet/sugarWithinLimit/sodiumWithinLimit`). Render these (e.g. fiber progress, sugar/
sodium over-limit warnings). Additive fields — safe to add.

### P2 — FE-26: Water (hydration) tracker
`POST /water` (amountMl + optional loggedAt/timezone), `GET /water?date&timezone` (entries + daily
total), `DELETE /water/{id}`. Add a hydration widget to the Nutrition page.

### P2 — FE-27: Barcode (+ external) + CSV export
Barcode scan → `GET /barcodes/{barcode}`. **It may now return an OpenFoodFacts result with
`foodId == null`** (external, not in catalog) when the local catalog misses + the feature is enabled
server-side — handle that case by logging it as a manual item (use the returned name + per-100g
macros), not via `foodCatalogItemId`. Add a "Export diary" download for `GET /export?from&to`
(CSV; range ≤ 370 days).

**Suggested order:** FE-20 → FE-21 → FE-22 (the search/quick-log core) → FE-23/24 (logging
convenience) → FE-25 (summary depth) → FE-26/27 (water, barcode/export).

## H. Workout backend integration (backend WO-1..11 shipped — FE must consume)

**Context (2026-06-19).** `workout-service` shipped a full API surface (WO-1..11, **all live on
backend `main`**, verified against backend `origin/main` `9f481c7`). FE-5 (above) wired only **5
read GETs** (`/sessions`, `/sessions/latest`, `/exercises`, `/plans?status=ACTIVE`,
`/plans/active`). **The Workout page is therefore read-only — a user cannot log a workout, build or
follow a plan, track sets live, or see PRs.** Ironically the FE can't even `POST /sessions`, so the
sessions it displays can only come from seed data / other clients. All endpoints below are under
`/api/v1/workouts`, JWT-scoped; **list endpoints return `PageResponse<T>` (`.content`)**. Each
ticket = its own PR (FE-4/5/6 isolation rule). **Verify each DTO against backend `origin/main`
before wiring** (`git -C backend show origin/main:workout-service/.../WorkoutController.java`).

### P1 — FE-28: Log a workout (the #1 gap — the write path)
`POST /sessions` (`UpsertWorkoutSessionRequest`: `name, workoutType, status, source=MANUAL,
startedAt, completedAt, durationMinutes, caloriesBurned, perceivedExertion, notes, exercises[]` each
with `sets[]`). Reactive form to record a session; on success reload sessions + toast. **Gotcha:**
`completedAt` is required iff `status=COMPLETED` and forbidden otherwise (400). The backend derives
volume/duration server-side — don't recompute client-side.

### P1 — FE-29: Plan lifecycle (create / edit / activate / archive / start)
`POST /plans`, `PUT /plans/{id}`, `POST /plans/{id}/activate` (**single active plan per user** —
activating one demotes the others to DRAFT), `DELETE /plans/{id}` (archive), and
`POST /plans/{id}/start` → seeds an `IN_PROGRESS` session from the plan (feeds FE-31). The Plans tab
currently hardcodes `?status=ACTIVE`; add a status filter so DRAFT/ARCHIVED are reachable.

### P1 — FE-30: Personal records + per-exercise progress
`GET /exercises/{id}/records` (`maxWeightKg, maxReps, maxSingleSetVolumeKg, estimatedOneRepMaxKg`
(Epley), `bestSessionVolumeKg` — **fields are null when there's no logged data → honest empty
state**) and `GET /exercises/{id}/history?from&to&page&size` (`PageResponse`, COMPLETED + logged
sets only, range ≤ 370 days → 400 over). Add an exercise-detail view: PR summary + a history trend
(reuse `<fs-chart>`). This is the core progression view, currently absent.

### P2 — FE-31: Live workout logger (the WO-6 save-as-you-go flow)
Rebuild the real in-workout logger (FE-5 removed the fake one). Flow: start a session
(`POST /plans/{id}/start`, or `POST /sessions` as `IN_PROGRESS`) → `POST /sessions/{id}/exercises`
(add one exercise) → `PUT /sessions/{id}/exercises/{exerciseLogId}/sets/{setNumber}` (log each set)
→ `POST /sessions/{id}/complete` (emits `WorkoutLogged`) or `POST /sessions/{id}/cancel`. **Only
PLANNED/IN_PROGRESS sessions are editable (terminal → 400).** Logging sets through these granular
endpoints is what marks them "performed" server-side, so they count toward PRs/aggregates — a
one-shot `PUT /sessions/{id}` full replace does not give per-set live UX. Coordinate with FE-19.

### P2 — FE-32: Exercise library management + metadata-driven controls
`POST /exercises` (create custom), `GET /exercises/{id}`, `PUT /exercises/{id}` (owner-only;
editing a global exercise → 403), `DELETE /exercises/{id}` (soft-archive). Drive the library
filters and create/edit forms off `GET /exercises/metadata` (`exerciseTypes, muscleGroups,
equipment, difficulties, workoutTypes, goalFocuses`) instead of hardcoding enums.

### P2 — FE-33: Session detail / edit / delete + repeat
`GET /sessions/{id}` (detail view — history rows are non-interactive today), `PUT /sessions/{id}`
(edit), `DELETE /sessions/{id}`, plus quick "repeat last workout" actions `POST /sessions/{id}/repeat`
and `POST /sessions/repeat-latest` (seeds a fresh `IN_PROGRESS` session from a past one).

### P3 — FE-34: Device import + workout data export
`POST /sessions/import` (batch external sessions, `source=DEVICE|IMPORTED` + `externalId`,
idempotent skip, per-row partial-success result) — surface behind a "connect / import" flow, or
defer until a real device/Strava source exists. `GET /export` returns the full workout data JSON
(custom exercises + plans + sessions) — pair it with the account/settings data-export.

**Events note (not a Workout-page ticket).** Logging via FE-28/FE-31 finally emits `WorkoutLogged`
→ the analytics dashboard populates for real. `PersonalRecordAchieved` (WO-5) is emitted on a new PR
but currently has **no consumer / notification surface** — wiring notification-service + a FE
notification center is a separate cross-service gap (see analytics AN-10), not scoped here.

**Suggested order:** FE-28 (log a workout) → FE-29 (plans) → FE-30 (PRs/history) → FE-31 (live
logger) → FE-32 (library mgmt) → FE-33 (session detail/repeat) → FE-34 (import/export).
