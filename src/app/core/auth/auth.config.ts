export interface CognitoAuthConfig {
  region: string;
  userPoolId: string;
  domain: string;
  clientId: string;
  apiEndpoint: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
}

// Per-environment Cognito pools. The SPA authenticates directly against the pool
// via USER_PASSWORD_AUTH (InitiateAuth), so the clientId here MUST match the pool
// the backend auth-service validates /api/v1/auth/bootstrap against. The pool is
// chosen at runtime by host, because the same build artifact is deployed to both
// the staging and production buckets (no per-env build).
interface CognitoPool {
  region: string;
  userPoolId: string;
  domain: string;
  clientId: string;
}

const PROD_POOL: CognitoPool = {
  region: 'ap-southeast-1',
  userPoolId: 'ap-southeast-1_myVyuOmPD',
  domain: 'https://ap-southeast-1myvyuompd.auth.ap-southeast-1.amazoncognito.com',
  clientId: '4mvse0cgmkplgocfg827uolvad'
};

const STAGING_POOL: CognitoPool = {
  region: 'ap-southeast-1',
  userPoolId: 'ap-southeast-1_vm11OfhXN',
  domain: 'https://fitsync-staging-437659978621.auth.ap-southeast-1.amazoncognito.com',
  clientId: 'q489scqc3ki0c2vvr3r5ongao'
};

// Hosts served by the staging environment use the staging pool: the custom domain
// and the staging distribution's own CloudFront name, which keeps working. Everything
// else (the prod CloudFront distribution, a future prod domain, localhost dev) falls
// back to the prod pool.
const STAGING_HOSTS = new Set<string>(['staging.fitsyncapp.click', 'd1z92tpb353lfi.cloudfront.net']);

export function buildCognitoAuthConfig(hostname: string, origin: string): CognitoAuthConfig {
  const pool = STAGING_HOSTS.has(hostname) ? STAGING_POOL : PROD_POOL;
  return {
    region: pool.region,
    userPoolId: pool.userPoolId,
    domain: pool.domain,
    clientId: pool.clientId,
    apiEndpoint: 'https://cognito-idp.ap-southeast-1.amazonaws.com/',
    redirectUri: `${origin}/auth/callback`,
    postLogoutRedirectUri: `${origin}/logout/callback`,
    scope: 'openid email profile'
  };
}

export const COGNITO_AUTH_CONFIG: CognitoAuthConfig = buildCognitoAuthConfig(
  window.location.hostname,
  window.location.origin
);

// ---------------------------------------------------------------------------
// Social sign-in (Google / Apple) — enablement seam.
//
// Federated login cannot use the custom USER_PASSWORD_AUTH page flow; it needs
// the Cognito Hosted UI authorization-code redirect and the IdPs configured on
// the user pool. Until that infra lands (see AUTH-SOCIAL-SIGNIN.md) this stays
// false: the login buttons render as a disabled "Soon" state.
//
// To go live: register the IdPs + callback URLs on the pool, implement the
// callback token exchange (AuthService.completeCallback), then flip this to
// true. `beginSocialSignIn` below already builds the correct authorize URL.
// ---------------------------------------------------------------------------
export const SOCIAL_SIGN_IN_ENABLED = false;

export type SocialProvider = 'Google' | 'Apple';

// Cognito identity-provider names differ from the display labels.
const SOCIAL_PROVIDER_IDP: Record<SocialProvider, string> = {
  Google: 'Google',
  Apple: 'SignInWithApple'
};

export function buildSocialAuthorizeUrl(config: CognitoAuthConfig, provider: SocialProvider): string {
  const params = new URLSearchParams({
    identity_provider: SOCIAL_PROVIDER_IDP[provider],
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope
  });
  return `${config.domain}/oauth2/authorize?${params.toString()}`;
}

export const AUTH_STORAGE_KEYS = {
  accessToken: 'fitsync.accessToken',
  idToken: 'fitsync.idToken',
  refreshToken: 'fitsync.refreshToken',
  expiresAt: 'fitsync.expiresAt',
  cognitoAccessToken: 'fitsync.cognitoAccessToken',
  cognitoIdToken: 'fitsync.cognitoIdToken',
  cognitoRefreshToken: 'fitsync.cognitoRefreshToken'
} as const;
