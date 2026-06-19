# FitSync AI — Frontend Tech Stack

## Current actual stack

The current FitSync frontend is built with:

- Angular 20 standalone components
- Angular Router
- Reactive Forms
- RxJS
- SCSS with FitSync design tokens
- chart.js and ng2-charts for Progress charts

Not installed in the current app:

- Angular Material
- Tailwind CSS
- NgRx Store / Effects

---

## Aspirational / not yet installed

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
- AWS Cognito user-pool authentication integration

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

Frontend authentication uses FitSync-owned Angular pages and Cognito User Pool APIs instead of Cognito Hosted UI or legacy backend credential endpoints.

Current confirmed local Cognito SPA settings:

- Region: `ap-southeast-1`
- User pool ID: `ap-southeast-1_myVyuOmPD`
- App client name: `FitSync`
- App client ID: `4mvse0cgmkplgocfg827uolvad`
- Cognito domain: `https://ap-southeast-1myvyuompd.auth.ap-southeast-1.amazoncognito.com`
- Cognito API endpoint: `https://cognito-idp.ap-southeast-1.amazonaws.com/`
- Callback URL: `http://localhost:3000/auth/callback`
- Sign-out URL: `http://localhost:3000/logout/callback`
- OAuth grant type: `Authorization code grant`
- Required custom-auth flow: `USER_PASSWORD_AUTH`
- OIDC scopes: `openid email profile`

Recommended frontend work items:

- keep an auth config source for Cognito values:
  - `region=ap-southeast-1`
  - `userPoolId=ap-southeast-1_myVyuOmPD`
  - `clientId=4mvse0cgmkplgocfg827uolvad`
  - `apiEndpoint=https://cognito-idp.ap-southeast-1.amazonaws.com/`
- provide Angular forms for sign-in, sign-up, email confirmation, and confirmation-code resend
- call Cognito `SignUp`, `ConfirmSignUp`, `ResendConfirmationCode`, and `InitiateAuth`
- call `POST /api/v1/auth/bootstrap` with the Cognito ID token after sign-in
- store the local FitSync JWT returned by bootstrap for protected backend API calls
- update the HTTP auth interceptor to preserve manually supplied Cognito `Authorization` headers during bootstrap
- update route guards to depend on Cognito-authenticated state instead of legacy local JWT-only assumptions
- call `GET /api/v1/auth/me` after bootstrap or on app startup to hydrate current-user state
- keep legacy `POST /api/v1/auth/login` and `POST /api/v1/auth/register` support only as temporary compatibility paths if rollout is phased

Expected frontend auth flow:

1. user signs up in the FitSync Angular form
2. frontend calls Cognito `SignUp`
3. user confirms the email code in the FitSync Angular form
4. frontend calls Cognito `ConfirmSignUp`
5. user signs in and frontend calls Cognito `InitiateAuth` with `USER_PASSWORD_AUTH`
6. frontend calls `POST /api/v1/auth/bootstrap` with the Cognito ID token
7. frontend stores the returned local FitSync JWT
8. guarded routes and API calls proceed with the local FitSync JWT

Implementation notes:

- prefer a dedicated `core/auth/` area for Cognito config, token storage, guards, and interceptor logic
- do not embed a client secret in frontend code; the active SPA app client is public and has no secret
- prefer using email as the visible login identity
- production and staging environments must enable the same app-client auth flow before rollout
- when backend `COGNITO_ENABLED=true`, frontend and backend must use the same app client ID and user pool

---

## Testing
- Jasmine
- Karma
- Cypress
