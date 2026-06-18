import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authTokenInterceptor } from '../auth-token.interceptor';
import { AUTH_STORAGE_KEYS, COGNITO_AUTH_CONFIG } from './auth.config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authTokenInterceptor])), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('reports unauthenticated when no token exists', () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('reports authenticated for a non-expired local access token', () => {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'token');
    localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(Date.now() + 60_000));

    expect(service.isAuthenticated()).toBeTrue();
  });

  it('restores a local FitSync token from the stored Cognito ID token when needed', (done) => {
    const localJwt = jwtWithExpiry(Math.floor((Date.now() + 3_600_000) / 1000));
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'stored-cognito-id-token');

    service.ensureSession().subscribe({
      next: (authenticated) => {
        expect(authenticated).toBeTrue();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBe(localJwt);
        done();
      },
      error: done.fail
    });

    const bootstrapRequest = httpMock.expectOne('/api/v1/auth/bootstrap');
    expect(bootstrapRequest.request.method).toBe('POST');
    expect(bootstrapRequest.request.headers.get('Authorization')).toBe('Bearer stored-cognito-id-token');
    bootstrapRequest.flush({
      accessToken: localJwt,
      tokenType: 'Bearer'
    });
  });

  it('clears the browser session if bootstrap restoration fails', (done) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'stored-cognito-id-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoAccessToken, 'stored-cognito-access-token');

    service.ensureSession().subscribe({
      next: (authenticated) => {
        expect(authenticated).toBeFalse();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.cognitoIdToken)).toBeNull();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
        done();
      },
      error: done.fail
    });

    const bootstrapRequest = httpMock.expectOne('/api/v1/auth/bootstrap');
    bootstrapRequest.flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
  });

  it('signs in with Cognito and stores the local FitSync token returned by bootstrap', (done) => {
    const localJwt = jwtWithExpiry(Math.floor((Date.now() + 3_600_000) / 1000));

    service.signIn('sam@example.com', 'supersecret').subscribe({
      next: () => {
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.cognitoAccessToken)).toBe('cognito-access-token');
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.cognitoIdToken)).toBe('cognito-id-token');
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBe(localJwt);
        expect(Number(localStorage.getItem(AUTH_STORAGE_KEYS.expiresAt))).toBeGreaterThan(Date.now());
        done();
      },
      error: done.fail
    });

    const cognitoRequest = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(cognitoRequest.request.method).toBe('POST');
    expect(cognitoRequest.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.InitiateAuth');
    expect(cognitoRequest.request.body).toEqual({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_AUTH_CONFIG.clientId,
      AuthParameters: {
        USERNAME: 'sam@example.com',
        PASSWORD: 'supersecret'
      }
    });
    cognitoRequest.flush({
      AuthenticationResult: {
        AccessToken: 'cognito-access-token',
        IdToken: 'cognito-id-token',
        ExpiresIn: 300
      }
    });

    const bootstrapRequest = httpMock.expectOne('/api/v1/auth/bootstrap');
    expect(bootstrapRequest.request.method).toBe('POST');
    expect(bootstrapRequest.request.headers.get('Authorization')).toBe('Bearer cognito-id-token');
    bootstrapRequest.flush({
      accessToken: localJwt,
      tokenType: 'Bearer'
    });
  });

  it('starts Cognito sign-up with email and display name attributes', (done) => {
    service.signUp('new@example.com', 'supersecret', 'New User').subscribe({
      next: () => done(),
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.SignUp');
    expect(request.request.body).toEqual({
      ClientId: COGNITO_AUTH_CONFIG.clientId,
      Username: 'new@example.com',
      Password: 'supersecret',
      UserAttributes: [
        { Name: 'email', Value: 'new@example.com' },
        { Name: 'name', Value: 'New User' }
      ]
    });
    request.flush({});
  });

  it('confirms a Cognito sign-up code', (done) => {
    service.confirmSignUp('new@example.com', '123456').subscribe({
      next: () => done(),
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.ConfirmSignUp');
    expect(request.request.body).toEqual({
      ClientId: COGNITO_AUTH_CONFIG.clientId,
      Username: 'new@example.com',
      ConfirmationCode: '123456'
    });
    request.flush({});
  });

  function jwtWithExpiry(exp: number): string {
    return ['header', base64Url(JSON.stringify({ exp })), 'signature'].join('.');
  }

  function base64Url(value: string): string {
    return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
});
