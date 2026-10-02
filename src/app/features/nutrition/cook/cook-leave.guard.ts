import { CanDeactivateFn } from '@angular/router';

/** What the guard needs of the cook page; typed here so the route does not load the page to ask. */
export interface CookLeaveAware {
  confirmLeave(): boolean | Promise<boolean>;
}

/** Leaving cook mode with running timers asks what to do with them first. */
export const cookLeaveGuard: CanDeactivateFn<CookLeaveAware> = (page) => page.confirmLeave();
