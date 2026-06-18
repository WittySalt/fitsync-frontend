# FitSync — Onboarding & Account Center Design Gaps

> Reviewed 2026-06-18 against real fitness apps (MyFitnessPal, Lose It!, Noom, Keep,
> Hevy, Strava, Fitbit, Apple Fitness, Nike Training Club, Cronometer) and the
> current implementation (`features/onboarding/`, `features/settings/` = the
> `/me` + `/settings` account center).
>
> Companion to `UIUX-AUDIT.md`. This file is the *design spec*; turn items into
> Codex tickets (FE-11+) once priorities are confirmed. Backend fields referenced
> are from `frontend-design-ai-brief.md`.

---

## Part 1 — Onboarding

### Current flow (6 steps)
Profile (name, DOB, gender, units) → Body (height, current/target weight, body fat,
activity) → **Goal (only `targetDate`)** → Training (level, location, days, duration,
time, intensity) → Nutrition (pattern, meal freq, calorie mode, macro, water) →
Review. Has BMR/TDEE estimate, seed prefill, computed kcal/protein on review.

### What real apps do that we don't

| # | Gap | What apps do | Priority |
|---|---|---|---|
| O1 | **No explicit "primary goal / intent" first** | MFP/Noom/Keep open with *"What's your goal?"* → Lose fat / Build muscle / Maintain / Improve fitness / Recomp. It frames every later default. | **P0** |
| O2 | **Goal step is anemic (`targetDate` only)** | Lose It!/MFP ask **target weight + weekly pace** (0.25/0.5/0.75/1.0 kg/wk) with a healthy-range guardrail, then show *projected date* + *daily calorie target*. We hard-code `-400/+250`. | **P0** |
| O3 | **Units choice not honored in inputs** | `preferredUnits=IMPERIAL` still shows cm/kg. Apps switch to ft/in + lb live. | **P0** |
| O4 | **Pre-filled "fake" defaults** (DOB 1996, 168cm, 72kg) | Apps start empty with pickers; defaults get silently submitted as real data. | **P1** |
| O5 | **No equipment inventory** | Hevy/Nike/Keep ask available equipment (none / dumbbells / barbell / bands / machines). We only have location HOME/GYM/MIXED. | **P1** |
| O6 | **No focus areas / target muscles** | Keep/Nike: full body / upper / core / lower / mobility. | **P2** |
| O7 | **No health/readiness screen (PAR-Q) or disclaimer** | Most health apps show a basic readiness + "not medical advice" disclaimer; matches the brief's "health-aware" tone. Add injury/limitation flags. | **P1** |
| O8 | **No editable computed plan on Review** | MFP shows recommended calories+macros you can override. Ours displays but can't edit. | **P1** |
| O9 | **No plausibility / health warnings** | Warn if target BMI < 18.5 or pace too aggressive. | **P1** |
| O10 | **No reminder times/days** | We set workout/meal/weigh-in *booleans* but no actual schedule. Apps pick time + weekdays. | **P2** |
| O11 | **No wearable / health-data connect** | Apple Health / Google Fit / Fitbit / Garmin import. Ship as a "coming soon" placeholder step. | **P2** |
| O12 | **No welcome / value / progress-expectation screen** | "~2 min, here's what we'll set up." Sets tone, reduces drop-off. | **P2** |
| O13 | **No skip / resume (progressive onboarding)** | Apps let you skip non-essential steps and finish later. We force all-required, no partial save. | **P2** |
| O14 | **Flat visual, no illustration/microcopy** | Keep/Noom lean heavily on per-step illustration + encouraging copy + animated stepper. | **P3** |

### Recommended target flow
`Welcome → Primary goal (O1) → About you (units-aware) → Body baseline → Goal &
pace (O2, live projection + warnings) → Activity & training (+equipment/focus) →
Nutrition (editable macro default) → Reminders (times) → Connect (placeholder) →
Review & plan (editable targets) → Dashboard`. Keep it skippable past step 5.

---

## Part 2 — Account Center (`/me` + `/settings`)

### Current state — already strong
Personal (identity, location/timezone, **full body metrics incl. circumferences**,
activity, goals), Preferences (units/language, training, nutrition), Security
(password, 2FA status, recovery email, active sessions), Notifications (channels +
reminders + weekly report + quiet hours), Privacy & Data (visibility, sharing,
**data export archive, danger-zone delete**). This is a mature settings surface.

### The structural problem
`/me` and `/settings` resolve to the **same settings page**. There is **no actual
"Me" profile/overview**. Every real app separates a *Profile/Me* tab (identity +
stats + achievements + activity) from *Settings* (configuration). That's the #1 gap.

### What real apps do that we don't

| # | Gap | What apps do | Priority |
|---|---|---|---|
| A1 | **No Profile/Me overview distinct from Settings** | Strava/Hevy/Keep "Me": avatar, name, membership, **lifetime stats, current streak, PRs, goal progress, recent activity**, then a link into Settings. | **P0** |
| A2 | **No Appearance/Theme setting** | Light / Dark / System lives in settings (ties to FE-2 ThemeService). Plus week-start, distance unit. | **P0** |
| A3 | **No body-metric history** | We edit only the *latest* metric (overwrite). Apps keep a **dated weight/measurement log** with add-new + trend. | **P1** |
| A4 | **No goal lifecycle view** | Brief §12 wants active/paused/completed lists; we only single-edit per type. Add history + complete/pause actions. | **P1** |
| A5 | **Session "revoke" not wired** | Rows say "Revocable" but no button; no "sign out all devices". | **P1** |
| A6 | **2FA enrollment flow absent** | Shows "Ready to configure" but no TOTP/SMS enroll UI. | **P1** |
| A7 | **Primary email change flow absent** | Only *recovery* email editable; no primary-email change + re-verify (Cognito attribute). | **P1** |
| A8 | **No connected accounts / integrations** | Manage linked Google/Apple sign-in (shown on login!) + wearables/health sources. | **P2** |
| A9 | **No subscription/membership management** | `membershipTier/Status` shown read-only; no plan/billing/invoice/upgrade. Add at least a plan card (placeholder if no billing backend). | **P2** |
| A10 | **No notification scheduling** | Toggles only — no per-reminder time/weekday (workout 18:00 Mon/Wed/Fri). | **P2** |
| A11 | **No avatar upload** | Only an Avatar-URL text field; apps upload+crop a photo. | **P2** |
| A12 | **No Help / About section** | App version, support/contact, terms, privacy policy, OSS licenses — standard footer of any account center. | **P2** |
| A13 | **Language select is inert (no i18n)** | Selecting a language does nothing. Either wire i18n or mark "coming soon". | **P3** |
| A14 | **Units change doesn't reformat displayed metrics** | Switch to imperial → body metrics still cm/kg. | **P2** |

### Recommended IA
- **`/me` → new Profile overview** (A1): avatar, membership, stats/streak/PRs, goal
  progress, recent activity, "Edit profile" + "Settings" entry points.
- **`/settings` → grouped config**, sections in this order: Personal · Body &
  measurements (A3) · Goals (A4) · **Appearance** (A2) · Preferences (units/lang/week
  start) · Training · Nutrition · Notifications (A10) · **Connected accounts** (A8) ·
  **Subscription** (A9) · Security (A5/A6/A7) · Privacy & data · **Help & About** (A12).

---

## Part 3 — Scope guidance for a capstone
- **Build real:** O1, O2, O3, O8, O9 (onboarding core); A1, A2, A3, A4, A5 (account
  core). These are high-impact and backed by existing brief APIs.
- **Ship as honest placeholders** (matches brief's "lightweight placeholder" rule):
  O11 wearables, A8 integrations, A9 billing, A6 2FA enroll, A13 i18n — a clean
  "Coming soon" card beats a fake control.
- **Always include** the required UX states (loading/error/empty/success, disabled-
  while-saving, preserve input on failure) per brief §14 and root `AGENTS.md`.

---

## Part 4 — Guided onboarding design language

The goal is that the user feels *led by the hand*, not handed a form. Eleven
principles, the supporting components, and the voice that ties them together.

### Principles
1. **One decision per screen** — conversational pacing; never more than one primary
   question visible. Lowers cognitive load.
2. **A named journey, not a percentage** — a step rail labelled
   `Goal · Train · Gear · Focus · Schedule · Plan`; completed segments get a check,
   current is filled `--accent`, upcoming is `--text-muted`.
3. **A coach voice that reacts** — a persistent second-person line that responds to
   each choice (pick *Outdoors* → "we'll prioritise runs and bodyweight circuits").
4. **"Your plan so far"** — a chip strip that grows as answers come in, so every
   choice visibly matters and the system feels like it's listening. Primary driver
   of the guided feeling.
5. **Choice as cards/chips, not dropdowns** — large tappable option cards (icon +
   title + one-line helper); selected = `--surface-tint` + `--border-accent` +
   check. Multi-select via pill chips.
6. **Live consequence** — when a choice changes a number (pace → date / calories),
   recompute immediately.
7. **Progressive disclosure + smart defaults + skip** — pre-fill sensible values;
   branch (indoor vs outdoor reveals different equipment); allow "set later" on
   non-essential steps; never show irrelevant fields.
8. **Momentum & reward** — the primary CTA always advances (trailing arrow); the
   Review step is a celebratory "Your plan is ready" with a check moment.
9. **Reassurance & safety** — privacy note up front ("only you see this"), a health
   readiness check where relevant (O7 / PAR-Q below), and "you can change everything
   later in Settings".
10. **Visual system** — Fraunces for the *question*, Inter for everything else;
    `--accent` green for selected/progress/CTA, `--amber-500` for warnings; single
    column, generous whitespace, CTA pinned bottom within thumb reach.
11. **Motion** — `--ease-spring` on select, `--dur-base` (200ms) step transitions,
    check pops in; all wrapped in `prefers-reduced-motion`.

### Components (build once, reuse)
- **Step rail** — `<fs-step-rail [steps]="..." [current]="i">`; states completed /
  current / upcoming per principle 2.
- **Coach line** — `<fs-coach [text]="...">`; an `--accent-subtle` avatar dot
  (Lucide `bolt`) + reactive copy. Copy lives in a per-step + per-choice map.
- **Live plan strip** — `<fs-plan-strip [plan]="signal">`; renders accumulated
  chips; same data feeds the Review summary.
- **Option card / chip** — reuse the existing `.option-card` token recipe; add a
  multi-select chip variant.

### Voice & tone
Three registers for the coach copy; pick per surface:
- **A — Friendly companion (DEFAULT for onboarding):** warm, second person,
  encouraging. "Fat loss it is — we'll pair training with a gentle deficit."
- **B — Professional trainer (use for in-app data/coaching cards):** precise,
  program-oriented. "Goal set: fat loss. I'll structure training around a moderate
  deficit."
- **C — Minimal/neutral:** persona-free. "Goal: fat loss." **Never use in
  onboarding** — it kills the guided feeling.

Tone tokens (all registers): second person; sentence case; **no emoji**; no hype
words ("crush it", "beast mode"); simple reading level; ≤2 lines per line.

### O7 — Health readiness step (PAR-Q+), optional but recommended
A lightweight readiness check placed after profile/goal, before any intensity is
prescribed. 5–7 yes/no toggles adapted from PAR-Q+ (heart condition, chest pain/
dizziness on exertion, bone/joint issues, BP/heart medication) plus injury-area
flags. Any "yes" → a **soft, non-blocking** notice ("We recommend checking with a
doctor first; we'll keep intensity conservative") + a persistent disclaimer
("FitSync is not medical advice"). Matches the brief's health-aware tone and lowers
liability. Capstone scope: store a few boolean flags (needs a backend field, or keep
front-end-only initially) and let them nudge default intensity.

### Suggested ticket numbering (continues UIUX-AUDIT.md)
FE-11 Profile/Me overview (A1) · FE-12 Onboarding goal-intent + pace + warnings
(O1/O2/O9) · FE-13 Units-aware inputs across onboarding+settings (O3/A14) · FE-14
Appearance/theme settings (A2, depends FE-2) · FE-15 Body-metric history (A3) ·
FE-16 Goal lifecycle (A4) · FE-17 Security actions: revoke/2FA/email (A5/A6/A7) ·
FE-18 Placeholders pack: integrations/billing/wearables/help-about (O11/A8/A9/A12).
