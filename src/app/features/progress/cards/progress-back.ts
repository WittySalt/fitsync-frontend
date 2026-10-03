import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * What "‹ Progress" does on a detail page (spec 1.3): step back when the entry before this one is in
 * this app, so Progress, a detail page and "‹ Progress" never loop; otherwise go to Progress.
 * The router stamps each entry it creates with a `navigationId`; the first entry of a page load is 1.
 */
@Injectable({ providedIn: 'root' })
export class ProgressBack {
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  hasEntryInApp(): boolean {
    const id = (this.location.getState() as { navigationId?: number } | null)?.navigationId;
    return typeof id === 'number' && id > 1;
  }

  /** Steps back when there is an entry to step back to, else opens `fallback` (Progress by default). */
  back(fallback = '/progress'): void {
    if (this.hasEntryInApp()) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(fallback);
    }
  }
}
