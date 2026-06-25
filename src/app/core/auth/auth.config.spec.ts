import { buildCognitoAuthConfig } from './auth.config';

describe('buildCognitoAuthConfig', () => {
  it('uses the staging Cognito pool on the staging CloudFront host', () => {
    const config = buildCognitoAuthConfig(
      'd1z92tpb353lfi.cloudfront.net',
      'https://d1z92tpb353lfi.cloudfront.net'
    );

    expect(config.userPoolId).toBe('ap-southeast-1_pHMjP2pf5');
    expect(config.clientId).toBe('5jd23m7184cunbfgshlh90h0lc');
    expect(config.domain).toContain('fitsync-staging-437659978621');
    expect(config.redirectUri).toBe('https://d1z92tpb353lfi.cloudfront.net/auth/callback');
    expect(config.postLogoutRedirectUri).toBe('https://d1z92tpb353lfi.cloudfront.net/logout/callback');
  });

  it('falls back to the prod Cognito pool on any other host', () => {
    const config = buildCognitoAuthConfig('d26vi6hikexzev.cloudfront.net', 'https://d26vi6hikexzev.cloudfront.net');

    expect(config.userPoolId).toBe('ap-southeast-1_myVyuOmPD');
    expect(config.clientId).toBe('4mvse0cgmkplgocfg827uolvad');
    expect(config.redirectUri).toBe('https://d26vi6hikexzev.cloudfront.net/auth/callback');
  });

  it('exposes a stable Cognito IDP api endpoint and OAuth scope', () => {
    const config = buildCognitoAuthConfig('localhost', 'http://localhost:4200');

    expect(config.apiEndpoint).toBe('https://cognito-idp.ap-southeast-1.amazonaws.com/');
    expect(config.scope).toBe('openid email profile');
    expect(config.userPoolId).toBe('ap-southeast-1_myVyuOmPD');
  });
});
