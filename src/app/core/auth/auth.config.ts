export interface CognitoAuthConfig {
  domain: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
}

export const COGNITO_AUTH_CONFIG: CognitoAuthConfig = {
  domain: 'https://ap-southeast-2kjyn2vzun.auth.ap-southeast-2.amazoncognito.com',
  clientId: '4mvse0cgmkplgocfg827uolvad',
  redirectUri: `${window.location.origin}/auth/callback`,
  postLogoutRedirectUri: `${window.location.origin}/logout/callback`,
  scope: 'openid email profile'
};

export const AUTH_STORAGE_KEYS = {
  accessToken: 'fitsync.accessToken',
  idToken: 'fitsync.idToken',
  refreshToken: 'fitsync.refreshToken',
  expiresAt: 'fitsync.expiresAt',
  pkceVerifier: 'fitsync.pkceVerifier',
  oauthState: 'fitsync.oauthState'
} as const;
