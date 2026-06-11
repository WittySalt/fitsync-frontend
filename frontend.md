# FitSync AI — Frontend Tech Stack

## Overview
Frontend is built as a responsive SPA for workout tracking, nutrition management, and progress analytics.

---

## Core Stack
- Angular 18+
- TypeScript
- Angular CLI

---

## UI / Styling
- Angular Material
- Tailwind CSS
- Angular CDK

---

## State Management
- NgRx Store
- NgRx Effects
- RxJS

---

## Routing / Security
- Angular Router
- Route Guards
- HTTP Interceptors
- JWT token persistence
- AWS Cognito managed login integration

---

## Forms
- Reactive Forms
- Angular Validators

---

## Data Visualization
- Chart.js
- ng2-charts

---

## Suggested Modules
```text
src/app/
├── core/
│   ├── auth/
│   ├── guards/
│   ├── interceptors/
│   └── services/
├── shared/
│   ├── components/
│   ├── pipes/
│   └── models/
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── workout/
│   ├── nutrition/
│   ├── dashboard/
│   ├── analytics/
│   └── recommendations/
```

---

## Main Pages
- Login / Register
- User Profile
- Goal Setup
- Workout Plan
- Workout Log
- Meal Log
- Dashboard
- Progress Analytics
- Recommendation Page

---

## Responsibilities
- UI rendering
- form validation
- API integration
- token management
- route protection
- charts and dashboards
- user interaction workflows

---

## API Communication
RESTful API integration with backend

Example:
```ts
GET /api/v1/workouts
POST /api/v1/meals
GET /api/v1/dashboard
```

---

## Cognito Integration

Frontend authentication should move to AWS Cognito managed login instead of posting credentials to local backend login endpoints.

Current confirmed local Cognito SPA settings:

- Region: `ap-southeast-2`
- User pool ID: `ap-southeast-2_8lgadn`
- App client name: `FitSync`
- App client ID: `4mvse0cgmkplgocfg827uolvad`
- Managed login domain: `https://ap-southeast-2kjyn2vzun.auth.ap-southeast-2.amazoncognito.com`
- Callback URL: `http://localhost:3000/auth/callback`
- Sign-out URL: `http://localhost:3000/logout/callback`
- OAuth grant type: `Authorization code grant`
- OIDC scopes: `openid email profile`

Recommended frontend work items:

- add an auth config source for Cognito values:
  - `authority=https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_8lgadn`
  - `clientId=4mvse0cgmkplgocfg827uolvad`
  - `redirectUri=http://localhost:3000/auth/callback`
  - `postLogoutRedirectUri=http://localhost:3000/logout/callback`
  - `responseType=code`
  - `scope=openid email profile`
- add a login action that redirects the browser to Cognito managed login with authorization code + PKCE
- add a callback route at `/auth/callback` to complete code exchange and store Cognito tokens
- add a logout flow that clears local auth state and redirects to Cognito sign-out
- add a logout callback route at `/logout/callback`
- update the HTTP auth interceptor to send the Cognito access token as `Authorization: Bearer <token>`
- update route guards to depend on Cognito-authenticated state instead of legacy local JWT-only assumptions
- call `POST /api/v1/auth/bootstrap` once after first successful Cognito sign-in so `auth-service` can provision the local business user
- call `GET /api/v1/auth/me` after bootstrap or on app startup to hydrate current-user state
- keep legacy `POST /api/v1/auth/login` and `POST /api/v1/auth/register` support only as temporary compatibility paths if rollout is phased

Expected frontend auth flow:

1. user clicks `Sign in`
2. frontend redirects to Cognito managed login
3. Cognito redirects back to `/auth/callback` with an authorization code
4. frontend completes the PKCE code exchange and stores tokens
5. frontend calls `POST /api/v1/auth/bootstrap`
6. frontend calls `GET /api/v1/auth/me`
7. guarded routes and API calls proceed with the Cognito access token

Implementation notes:

- prefer a dedicated `core/auth/` area for Cognito config, token storage, guards, and interceptor logic
- do not embed a client secret in frontend code; the active SPA app client is public and has no secret
- prefer using email as the visible login identity
- production and staging environments must register their own callback and sign-out URLs in Cognito before rollout
- when backend `COGNITO_ENABLED=true`, frontend and backend must use the same app client ID and user pool

---

## Testing
- Jasmine
- Karma
- Cypress
