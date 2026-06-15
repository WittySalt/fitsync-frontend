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

export const COGNITO_AUTH_CONFIG: CognitoAuthConfig = {
  region: 'ap-southeast-1',
  userPoolId: 'ap-southeast-1_myVyuOmPD',
  domain: 'https://ap-southeast-1myvyuompd.auth.ap-southeast-1.amazoncognito.com',
  clientId: '4mvse0cgmkplgocfg827uolvad',
  apiEndpoint: 'https://cognito-idp.ap-southeast-1.amazonaws.com/',
  redirectUri: `${window.location.origin}/auth/callback`,
  postLogoutRedirectUri: `${window.location.origin}/logout/callback`,
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
