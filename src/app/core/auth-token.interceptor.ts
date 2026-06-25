import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';

import { AuthService } from './auth/auth.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();
  const isCognitoIdpRequest = request.url.startsWith('https://cognito-idp.');
  const isAuthBootstrapRequest = request.url.startsWith('/api/v1/auth/bootstrap');
  const isApiRequest = request.url.startsWith('/api/v1/');

  if (isCognitoIdpRequest || isAuthBootstrapRequest || !isApiRequest || request.headers.has('Authorization')) {
    return next(request);
  }

  if (token) {
    return next(withAuthorization(request, token));
  }

  return authService.ensureSession().pipe(
    switchMap((authenticated) => {
      const readyToken = authService.getAccessToken();
      if (!authenticated || !readyToken) {
        return next(request);
      }

      return next(withAuthorization(request, readyToken));
    })
  );
};

function withAuthorization(request: Parameters<HttpInterceptorFn>[0], token: string): Parameters<HttpInterceptorFn>[0] {
  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}
