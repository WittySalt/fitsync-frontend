import { Component, inject } from '@angular/core';

import { CoachStore } from '../../core/coach/coach.store';

/**
 * The dim layer behind the dock on mid-width screens (861 to 1199 px), where the dock overlays the
 * page instead of sharing it. Pressing it closes the dock. Outside that band it is not shown.
 */
@Component({
  selector: 'app-coach-scrim',
  template: `<div class="scrim" data-testid="coach-scrim" aria-hidden="true" (click)="store.close()"></div>`,
  styles: [
    `
      .scrim {
        display: none;
      }
      @media (min-width: 861px) and (max-width: 1199px) {
        .scrim {
          display: block;
          position: fixed;
          inset: 0;
          z-index: calc(var(--z-overlay) - 1);
          background: rgb(0 0 0 / 0.4);
        }
      }
    `
  ]
})
export class CoachScrimComponent {
  protected readonly store = inject(CoachStore);
}
