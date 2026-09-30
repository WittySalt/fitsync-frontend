import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, Observable, of, switchMap } from 'rxjs';

import { AccountDataService } from '../account-data.service';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const accountDataService = inject(AccountDataService);
  const router = inject(Router);

  return authService.ensureSession().pipe(
    switchMap((authenticated) => {
      if (!authenticated) {
        return of(router.createUrlTree(['/auth/login']));
      }

      return accountDataService.getCurrentUser().pipe(
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

/**
 * Keeps the admin area to administrators as a convenience for the interface. It waits for the
 * current-user response so that a reload on an admin page does not bounce an admin, but the
 * server refuses a member on every admin call whatever this guard decided.
 */
export const adminGuard: CanActivateFn = (): Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const accountDataService = inject(AccountDataService);
  const router = inject(Router);

  return authService.ensureSession().pipe(
    switchMap((authenticated) => {
      if (!authenticated) {
        return of(router.createUrlTree(['/auth/login']));
      }

      return accountDataService.getCurrentUser().pipe(
        map(() => (authService.isAdmin() ? true : router.createUrlTree(['/dashboard']))),
        catchError(() => of(router.createUrlTree(['/auth/login'])))
      );
    })
  );
};
