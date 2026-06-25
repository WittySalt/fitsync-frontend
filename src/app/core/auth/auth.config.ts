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
  userPoolId: 'ap-southeast-1_pHMjP2pf5',
  domain: 'https://fitsync-staging-437659978621.auth.ap-southeast-1.amazoncognito.com',
  clientId: '5jd23m7184cunbfgshlh90h0lc'
};

// Hosts served by the staging environment use the staging pool. Everything else
// (the prod CloudFront distribution, localhost dev) falls back to the prod pool.
const STAGING_HOSTS = new Set<string>(['d1z92tpb353lfi.cloudfront.net']);

function resolvePool(): CognitoPool {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  return STAGING_HOSTS.has(host) ? STAGING_POOL : PROD_POOL;
}

const pool = resolvePool();
const origin = typeof window !== 'undefined' ? window.location.origin : '';

export const COGNITO_AUTH_CONFIG: CognitoAuthConfig = {
  region: pool.region,
  userPoolId: pool.userPoolId,
  domain: pool.domain,
  clientId: pool.clientId,
  apiEndpoint: 'https://cognito-idp.ap-southeast-1.amazonaws.com/',
  redirectUri: `${origin}/auth/callback`,
  postLogoutRedirectUri: `${origin}/logout/callback`,
  scope: 'openid email profile'
};

export const AUTH_STORAGE_KEYS = {
  accessToken: 'fitsync.accessToken',
  idToken: 'fitsync.idToken',
  refreshToken: 'fitsync.refreshToken',
  expiresAt: 'fitsync.expiresAt',
  cognitoAccessToken: 'fitsync.cognitoAccessToken',
  cognitoIdToken: 'fitsync.cognitoIdToken',
  cognitoRefreshToken: 'fitsync.cognitoRefreshToken'
} as const;
