# Social sign-in (Google / Apple) — enablement notes

The login page (`src/app/features/auth/login.page.html`) shows **Google** and **Apple**
sign-in buttons in a disabled "Soon" state. They are intentionally non-functional until
the Cognito user pool is configured for federated identity providers.

This is a deliberate interim: the buttons preserve the design intent without the previous
silent dead-end (clicking used to only flash a "not connected yet" notice).

## Why the frontend cannot ship this alone

The app currently authenticates **directly against Cognito** with
`USER_PASSWORD_AUTH` (`InitiateAuth`) from a public app client — see
`src/app/core/auth/auth.service.ts`. Federated social login cannot use that flow; it
requires the **Hosted UI / OAuth2 authorization-code redirect**:

```
/oauth2/authorize?identity_provider=Google&response_type=code&client_id=…&redirect_uri=…&scope=openid+email+profile
  → Google/Apple consent
  → {redirect_uri}?code=…
  → POST /oauth2/token (code → id/access/refresh tokens)
  → POST /api/v1/auth/bootstrap (existing) with the Cognito ID token
```

Note: `AuthService.completeCallback()` currently throws
("Hosted UI callback is no longer used") because the team moved to custom pages.
Enabling social login re-introduces the Hosted UI redirect for these providers only.

## Backend / infra prerequisites (before wiring the frontend)

Per environment (staging + prod pools in `src/app/core/auth/auth.config.ts`):

1. **Register the IdPs** in the Cognito user pool:
   - Google: OAuth client ID + secret (Google Cloud console), attribute mapping
     `email → email`, `name → name`.
   - Apple: Services ID, Team ID, Key ID, private key (Apple Developer), same mapping.
2. **App client**: enable the `Google` and `SignInWithApple` identity providers, enable
   the **authorization code grant**, add allowed OAuth scopes `openid email profile`.
3. **Callback / sign-out URLs**: add `https://<host>/auth/callback` and
   `https://<host>/logout/callback` to the app client (both staging + prod hosts).
4. **Hosted UI domain**: already present (`domain` in `auth.config.ts`); confirm it is
   active for each pool.

## The seam that already exists

The frontend is pre-wired so enabling this is a small, contained change — no refactor:

- `SOCIAL_SIGN_IN_ENABLED` (in `auth.config.ts`) gates everything. It is `false` today.
- `buildSocialAuthorizeUrl(config, provider)` builds the correct Hosted UI
  `/oauth2/authorize` URL (Google → `Google`, Apple → `SignInWithApple`).
- `AuthService.beginSocialSignIn(provider)` redirects there — but is a **no-op while the
  flag is false**, so the login buttons can bind it unconditionally.
- `login.page.html` reads `socialSignInEnabled`: the Google/Apple buttons are `disabled`
  with a "Soon" badge when off, and become live `(click)="continueWith(...)"` when on.

## Frontend work once infra is ready

1. Flip `SOCIAL_SIGN_IN_ENABLED` to `true`. The buttons go live and redirect into the
   Hosted UI automatically — no template or handler edits needed.
2. Re-implement `AuthService.completeCallback()` (currently throws) to exchange the
   returned `code` at `/oauth2/token`, store the Cognito tokens, then call the existing
   `bootstrapWithCognitoToken()`. `auth-callback.page.ts` already routes the callback
   through it.
3. That's it — the disabled-state badge/hint hide themselves when the flag is on.
