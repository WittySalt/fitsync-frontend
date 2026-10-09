import { HttpErrorResponse, HttpEvent, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Observable, switchMap, throwError } from 'rxjs';

import { apiErrorCode, AUTH_REFRESH_URL, AuthService, SESSION_REVOKED_CODE } from './auth/auth.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();
  const isCognitoIdpRequest = request.url.startsWith('https://cognito-idp.');
  const isAuthBootstrapRequest = request.url.startsWith('/api/v1/auth/bootstrap');
  // The refresh call carries no access token and must never start another refresh.
  const isAuthRefreshRequest = request.url.startsWith(AUTH_REFRESH_URL);
  const isApiRequest = request.url.startsWith('/api/v1/');

  if (
    isCognitoIdpRequest ||
    isAuthBootstrapRequest ||
    isAuthRefreshRequest ||
    !isApiRequest ||
    request.headers.has('Authorization')
  ) {
    return next(request);
  }

  if (token) {
    return sendWithToken(request, next, authService, token);
  }

  return authService.ensureSession().pipe(
    switchMap((authenticated) => {
      const readyToken = authService.getAccessToken();
      if (!authenticated || !readyToken) {
        return next(request);
      }

      return sendWithToken(request, next, authService, readyToken);
    })
  );
};

/**
 * Sends the request with the token. A 401 that says this device was signed out ends the session.
 * Any other 401 is answered with one refresh and one retry. The retry is never refreshed again,
 * so a request can cause at most one refresh.
 */
function sendWithToken(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  token: string
): Observable<HttpEvent<unknown>> {
  return next(withAuthorization(request, token)).pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error)) {
        return throwError(() => error);
      }
      if (apiErrorCode(error) === SESSION_REVOKED_CODE) {
        authService.endSession('revoked');
        return throwError(() => error);
      }
      // An older backend issues no refresh token, and then a 401 reaches the caller as before.
      if (!authService.hasRefreshToken()) {
        return throwError(() => error);
      }
      return authService.refreshAccessToken(token).pipe(
        // A failed refresh hands the caller the original error. A refresh refused with 401 has
        // already ended the session.
        catchError(() => throwError(() => error)),
        switchMap((freshToken) =>
          next(withAuthorization(request, freshToken)).pipe(
            catchError((retryError: unknown) => {
              if (isUnauthorized(retryError) && apiErrorCode(retryError) === SESSION_REVOKED_CODE) {
                authService.endSession('revoked');
              }
              return throwError(() => retryError);
            })
          )
        )
      );
    })
  );
}

function isUnauthorized(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 401;
}

function withAuthorization(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}
