import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
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

  it('shares an in-flight bootstrap session across callers', () => {
    const localJwt = jwtWithExpiry(Math.floor((Date.now() + 3_600_000) / 1000));
    const results: boolean[] = [];
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'stored-cognito-id-token');

    service.ensureSession().subscribe((authenticated) => results.push(authenticated));
    service.ensureSession().subscribe((authenticated) => results.push(authenticated));

    const bootstrapRequest = httpMock.expectOne('/api/v1/auth/bootstrap');
    bootstrapRequest.flush({
      accessToken: localJwt,
      tokenType: 'Bearer'
    });

    expect(results).toEqual([true, true]);
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBe(localJwt);
  });

  it('waits for bootstrap before sending protected API requests', () => {
    const http = TestBed.inject(HttpClient);
    const localJwt = jwtWithExpiry(Math.floor((Date.now() + 3_600_000) / 1000));
    let response: { ok: boolean } | undefined;
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'stored-cognito-id-token');

    http.get<{ ok: boolean }>('/api/v1/analytics/dashboard').subscribe((value) => {
      response = value;
    });

    const bootstrapRequest = httpMock.expectOne('/api/v1/auth/bootstrap');
    httpMock.expectNone('/api/v1/analytics/dashboard');
    bootstrapRequest.flush({
      accessToken: localJwt,
      tokenType: 'Bearer'
    });

    const protectedRequest = httpMock.expectOne('/api/v1/analytics/dashboard');
    expect(protectedRequest.request.headers.get('Authorization')).toBe(`Bearer ${localJwt}`);
    protectedRequest.flush({ ok: true });

    expect(response).toEqual({ ok: true });
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

  it('changes password through Cognito with the stored access token', (done) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'local-fitsync-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoAccessToken, 'cognito-access-token');

    service.changePassword('old-password', 'NewPassword1').subscribe({
      next: () => done(),
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.ChangePassword');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(request.request.body).toEqual({
      AccessToken: 'cognito-access-token',
      PreviousPassword: 'old-password',
      ProposedPassword: 'NewPassword1'
    });
    request.flush({});
  });

  it('signs out everywhere through Cognito and clears stored tokens', (done) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'local-fitsync-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoAccessToken, 'cognito-access-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, 'cognito-id-token');
    spyOn(service, 'logout').and.callFake(() => service.completeLogout());

    service.signOutEverywhere().subscribe({
      next: () => {
        expect(service.logout).toHaveBeenCalled();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.cognitoAccessToken)).toBeNull();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.cognitoIdToken)).toBeNull();
        done();
      },
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.GlobalSignOut');
    expect(request.request.body).toEqual({ AccessToken: 'cognito-access-token' });
    request.flush({});
  });

  it('deletes the Cognito user with the stored access token', (done) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoAccessToken, 'cognito-access-token');
    spyOn(service, 'logout').and.callFake(() => service.completeLogout());

    service.deleteAccount().subscribe({
      next: () => done(),
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.DeleteUser');
    expect(request.request.body).toEqual({ AccessToken: 'cognito-access-token' });
    request.flush({});
  });

  it('uses an existing valid local session without bootstrapping', (done) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'local-fitsync-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(Date.now() + 60_000));

    service.ensureSession().subscribe({
      next: (authenticated) => {
        expect(authenticated).toBeTrue();
        httpMock.expectNone('/api/v1/auth/bootstrap');
        done();
      },
      error: done.fail
    });
  });

  it('clears expired local tokens when no Cognito session exists', (done) => {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'expired-local-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.idToken, 'expired-id-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, 'expired-refresh-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(Date.now() - 60_000));

    service.ensureSession().subscribe({
      next: (authenticated) => {
        expect(authenticated).toBeFalse();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBeNull();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.idToken)).toBeNull();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken)).toBeNull();
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.expiresAt)).toBeNull();
        done();
      },
      error: done.fail
    });
  });

  it('stores optional Cognito refresh tokens and falls back for opaque local tokens', (done) => {
    service.signIn(' sam@example.com ', 'supersecret').subscribe({
      next: () => {
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.cognitoRefreshToken)).toBe('cognito-refresh-token');
        expect(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).toBe('opaque-local-token');
        expect(Number(localStorage.getItem(AUTH_STORAGE_KEYS.expiresAt))).toBeGreaterThan(Date.now());
        done();
      },
      error: done.fail
    });

    const cognitoRequest = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(cognitoRequest.request.body.AuthParameters.USERNAME).toBe('sam@example.com');
    cognitoRequest.flush({
      AuthenticationResult: {
        AccessToken: 'cognito-access-token',
        IdToken: 'cognito-id-token',
        RefreshToken: 'cognito-refresh-token',
        ExpiresIn: 300
      }
    });

    httpMock.expectOne('/api/v1/auth/bootstrap').flush({
      accessToken: 'opaque-local-token',
      tokenType: 'Bearer'
    });
  });

  it('omits the display name attribute when sign-up receives only whitespace', (done) => {
    service.signUp(' new@example.com ', 'supersecret', '   ').subscribe({
      next: () => done(),
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.body).toEqual({
      ClientId: COGNITO_AUTH_CONFIG.clientId,
      Username: 'new@example.com',
      Password: 'supersecret',
      UserAttributes: [{ Name: 'email', Value: 'new@example.com' }]
    });
    request.flush({});
  });

  it('resends the confirmation code through Cognito', (done) => {
    service.resendConfirmationCode(' new@example.com ').subscribe({
      next: () => done(),
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.ResendConfirmationCode');
    expect(request.request.body).toEqual({
      ClientId: COGNITO_AUTH_CONFIG.clientId,
      Username: 'new@example.com'
    });
    request.flush({});
  });

  it('requests a Cognito password reset code', (done) => {
    service.forgotPassword(' sam@example.com ').subscribe({
      next: () => done(),
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.ForgotPassword');
    expect(request.request.body).toEqual({
      ClientId: COGNITO_AUTH_CONFIG.clientId,
      Username: 'sam@example.com'
    });
    request.flush({});
  });

  it('confirms a Cognito password reset with the code and new password', (done) => {
    service.confirmForgotPassword(' sam@example.com ', ' 123456 ', 'NewPassword1').subscribe({
      next: () => done(),
      error: done.fail
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    expect(request.request.headers.get('X-Amz-Target')).toBe('AWSCognitoIdentityProviderService.ConfirmForgotPassword');
    expect(request.request.body).toEqual({
      ClientId: COGNITO_AUTH_CONFIG.clientId,
      Username: 'sam@example.com',
      ConfirmationCode: '123456',
      Password: 'NewPassword1'
    });
    request.flush({});
  });

  it('maps reset-code and password-policy Cognito errors to friendly messages', (done) => {
    service.confirmForgotPassword('sam@example.com', '000000', 'weak').subscribe({
      next: () => done.fail('expected code-mismatch rejection'),
      error: (mismatchError: Error) => {
        expect(mismatchError.message).toBe('That code is incorrect. Check your email and try again.');

        service.confirmForgotPassword('sam@example.com', '000000', 'weak').subscribe({
          next: () => done.fail('expected invalid-password rejection'),
          error: (passwordError: Error) => {
            expect(passwordError.message).toBe('Password does not satisfy policy.');
            done();
          }
        });

        httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush(
          { __type: 'InvalidPasswordException', message: 'Password does not satisfy policy.' },
          { status: 400, statusText: 'Bad Request' }
        );
      }
    });

    httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush(
      { __type: 'CodeMismatchException', message: 'wrong code' },
      { status: 400, statusText: 'Bad Request' }
    );
  });

  it('rejects unsupported Cognito challenges and missing token responses', (done) => {
    service.signIn('sam@example.com', 'supersecret').subscribe({
      next: () => done.fail('expected challenge rejection'),
      error: (error: Error) => {
        expect(error.message).toContain('Cognito challenge is not implemented yet');

        service.signIn('sam@example.com', 'supersecret').subscribe({
          next: () => done.fail('expected token rejection'),
          error: (missingTokenError: Error) => {
            expect(missingTokenError.message).toBe('Cognito did not return the required tokens.');
            done();
          }
        });

        httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush({ AuthenticationResult: { AccessToken: 'token', ExpiresIn: 300 } });
      }
    });

    httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush({ ChallengeName: 'NEW_PASSWORD_REQUIRED' });
  });

  it('rejects password, global sign-out, and account deletion without a Cognito access token', (done) => {
    service.changePassword('old', 'new').subscribe({
      next: () => done.fail('expected missing-token rejection'),
      error: (changeError: Error) => {
        expect(changeError.message).toBe('Cognito session has expired. Please sign in again.');

        service.signOutEverywhere().subscribe({
          next: () => done.fail('expected missing-token rejection'),
          error: (signOutError: Error) => {
            expect(signOutError.message).toBe('Cognito session has expired. Please sign in again.');

            service.deleteAccount().subscribe({
              next: () => done.fail('expected missing-token rejection'),
              error: (deleteError: Error) => {
                expect(deleteError.message).toBe('Cognito session has expired. Please sign in again.');
                done();
              }
            });
          }
        });
      }
    });
  });

  it('surfaces the hosted UI callback deprecation error', (done) => {
    service.completeCallback('code', 'state').subscribe({
      next: () => done.fail('expected callback rejection'),
      error: (error: Error) => {
        expect(error.message).toContain('Hosted UI callback is no longer used');
        done();
      }
    });
  });

  it('maps common Cognito and network errors to user-facing messages', (done) => {
    service.signIn('sam@example.com', 'supersecret').subscribe({
      next: () => done.fail('expected network rejection'),
      error: (networkError: Error) => {
        expect(networkError.message).toContain('Unable to reach Cognito');

        service.signIn('sam@example.com', 'supersecret').subscribe({
          next: () => done.fail('expected unconfirmed rejection'),
          error: (unconfirmedError: Error) => {
            expect(unconfirmedError.message).toBe('Please confirm your email before signing in.');

            service.signIn('sam@example.com', 'supersecret').subscribe({
              next: () => done.fail('expected invalid auth-flow rejection'),
              error: (invalidParameterError: Error) => {
                expect(invalidParameterError.message).toContain('USER_PASSWORD_AUTH');
                done();
              }
            });

            httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush(
              { __type: 'InvalidParameterException', message: 'USER_PASSWORD_AUTH is not enabled' },
              { status: 400, statusText: 'Bad Request' }
            );
          }
        });

        httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush(
          { __type: 'UserNotConfirmedException', message: 'not confirmed' },
          { status: 400, statusText: 'Bad Request' }
        );
      }
    });

    const request = httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint);
    request.error(new ProgressEvent('network error'), { status: 0, statusText: 'Unknown Error' });
  });

  it('passes through string and default HTTP error messages', (done) => {
    service.confirmSignUp('new@example.com', '123456').subscribe({
      next: () => done.fail('expected string error rejection'),
      error: (stringError: Error) => {
        expect(stringError.message).toBe('plain Cognito error');

        service.signIn('sam@example.com', 'supersecret').subscribe({
          next: () => done.fail('expected not-authorized rejection'),
          error: (notAuthorizedError: Error) => {
            expect(notAuthorizedError.message).toBe('Invalid email or password.');

            service.signUp('new@example.com', 'supersecret', 'New User').subscribe({
              next: () => done.fail('expected fallback rejection'),
              error: (fallbackError: Error) => {
                expect(fallbackError.message).toContain('500 Server Error');
                done();
              }
            });

            httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush({}, { status: 500, statusText: 'Server Error' });
          }
        });

        httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush(
          { __type: 'NotAuthorizedException', message: 'bad credentials' },
          { status: 400, statusText: 'Bad Request' }
        );
      }
    });

    httpMock.expectOne(COGNITO_AUTH_CONFIG.apiEndpoint).flush('plain Cognito error', { status: 400, statusText: 'Bad Request' });
  });

  function jwtWithExpiry(exp: number): string {
    return ['header', base64Url(JSON.stringify({ exp })), 'signature'].join('.');
  }

  function base64Url(value: string): string {
    return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
});
