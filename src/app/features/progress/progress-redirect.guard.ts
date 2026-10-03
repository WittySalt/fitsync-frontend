import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * The old Progress tabs, kept working as links: `?tab=body` opens the Goal page and `?tab=goals`
 * opens it at the goals it shows. `?tab=overview` and anything else open Progress itself.
 */
export const progressTabRedirect: CanActivateFn = (route) => {
  const router = inject(Router);
  const tab = route.queryParamMap.get('tab');
  if (tab === 'body') {
    return router.createUrlTree(['/progress/goal']);
  }
  if (tab === 'goals') {
    return router.createUrlTree(['/progress/goal'], { fragment: 'other-goals' });
  }
  return true;
};
