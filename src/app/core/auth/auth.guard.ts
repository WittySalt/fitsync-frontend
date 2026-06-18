import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

import { AuthService } from './auth.service';

interface OnboardingStatusResponse {
  profile?: {
    onboardingCompleted?: boolean;
  } | null;
}

export const authGuard: CanActivateFn = (_route, state): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const http = inject(HttpClient);

  return authService.ensureSession().pipe(
    switchMap((authenticated) => {
      if (!authenticated) {
        return of(router.createUrlTree(['/auth/login']));
      }

      return http.get<OnboardingStatusResponse>('/api/v1/users/me').pipe(
        map((user) => {
          const onboardingCompleted = user.profile?.onboardingCompleted ?? false;
          const onboardingRoute = state.url.startsWith('/onboarding');

          if (!onboardingCompleted && !onboardingRoute) {
            return router.createUrlTree(['/onboarding']);
          }

          return true;
        }),
        catchError(() => of(router.createUrlTree(['/auth/login'])))
      );
    })
  );
};
