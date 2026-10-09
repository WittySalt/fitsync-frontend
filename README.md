# FitSync Frontend

The web app for FitSync, a fitness and nutrition tracker. It is an Angular 20
single-page app that talks to the FitSync Spring Boot backend over `/api/v1/*`
and signs people in with Amazon Cognito.

## What's in the app

| Area | Route | What it does |
|---|---|---|
| Dashboard | `/dashboard` | The daily brief: today's plan, the week and month at a glance, what was earned |
| Workout | `/workout` | Plans (create and edit under `/workout/plans/…`), the guided exercise player, live sessions, history |
| Nutrition | `/nutrition` | Food diary and meal builder, nutrients (`/nutrition/nutrients`), recipes and cook mode (`/nutrition/recipes/…`) |
| Progress | `/progress` | Training, energy, food and goal trends |
| Coach | dock on every page, `/coach/plan` | The AI coach chat (streamed answers) and coach-proposed plans |
| Profile | `/me`, `/me/achievements` | Profile overview, targets, badges |
| Settings | `/settings` | Account, preferences, avatar, data and account deletion |
| Onboarding | `/onboarding` | First-run setup: profile, goal, preferences |
| Admin | `/admin/…` | Coach quality, exercise catalogue, users, events. Admin role only |

Every route except the sign-in pages is behind `authGuard`, and `/admin` is behind `adminGuard`.
`src/app/app.routes.ts` has the full list.

## Getting started

Requirements: Node 20 and npm.

```bash
npm ci
npm start            # http://localhost:3000
```

The dev server must run on port **3000**, because the Cognito app client only
allows `http://localhost:3000/auth/callback` and `/logout/callback` as redirect
URLs. `npm run start:4200` serves on Angular's default port for checks that
don't need to sign in.

`proxy.conf.json` forwards `/api` to the backend gateway at
`http://localhost:8088`, so start the backend locally first, or edit the proxy
target to point at another environment.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server on port 3000 with the `/api` proxy |
| `npm run build` | Production build into `dist/fitsync-frontend/` |
| `npm run watch` | Development build in watch mode |
| `npm test` | Karma + Jasmine unit tests (add `-- --watch=false --browsers=ChromeHeadlessNoGpu` for a single headless run) |
| `npm run lint` | ESLint for TypeScript and templates, including the accessibility rules |
| `npx tsc --noEmit` | Typecheck, the same as the CI `typecheck` job |

## Project layout

```text
src/
├── app/
│   ├── app.routes.ts      routes and guards
│   ├── core/              app-wide services: auth, API data services, models and
│   │                      mappers, the coach API, timezone handling, theme, toasts
│   ├── shared/            reusable components: charts, the coach dock, food and
│   │                      progress widgets, dialogs, pager, toggle
│   └── features/          one folder per area (dashboard, workout, nutrition,
│                          progress, profile, settings, onboarding, auth, admin, coach)
├── styles.scss            global styles
└── styles/                design tokens (fitsync-tokens, progress-tokens)
infra/terraform/           frontend AWS infrastructure (S3 + CloudFront)
.github/workflows/         CI and CD
```

Components are standalone and use signals. Feature pages are lazy-loaded from
`app.routes.ts`. Specs sit next to the files they test (`*.spec.ts`).

## Authentication

The sign-in, sign-up and confirmation screens are FitSync's own Angular pages,
not the Cognito Hosted UI. They call the Cognito User Pool API directly with
`USER_PASSWORD_AUTH`:

1. Sign in with Cognito (`InitiateAuth`).
2. Send the Cognito token to `POST /api/v1/auth/bootstrap`, which returns
   FitSync's own access token.
3. `auth-token.interceptor.ts` adds that token to every `/api` request, and
   `timezone.interceptor.ts` adds the user's timezone.

The pool and app client for each environment are set in
`src/app/core/auth/auth.config.ts`: staging is chosen by host name, and
everything else uses production. These are public SPA client IDs, so there is
no client secret in the frontend. Google and Apple sign-in are built but turned
off; [`AUTH-SOCIAL-SIGNIN.md`](AUTH-SOCIAL-SIGNIN.md) explains what has to be
set up before they can be turned on.

## CI/CD

CI/CD runs on GitHub Actions only.

- **CI** (`.github/workflows/ci.yml`) runs on pull requests and on pushes to
  `main`/`develop`: gitleaks secret scan, typecheck, unit tests with coverage,
  and the production build.
- **CD** (`.github/workflows/cd.yml`) is started by hand. It can apply the
  staging infrastructure, deploy the build to the staging bucket, or deploy it
  to production. It does nothing until the AWS repository variables are set.
  It deploys only `main` commits whose CI push run passed, and production only
  takes a commit that was deployed to staging first (break-glass needs a
  written reason).

[`.github/CICD-VARIABLES.md`](.github/CICD-VARIABLES.md) lists the variables.
[`infra/terraform/RUNBOOK.md`](infra/terraform/RUNBOOK.md) covers the
infrastructure. In each environment, CloudFront serves the SPA from S3 and
forwards `/api/*` to the backend, so the app always calls a same-origin `/api`.
