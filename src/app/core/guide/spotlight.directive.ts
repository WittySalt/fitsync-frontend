import { Directive, ElementRef, OnInit, effect, inject, input } from '@angular/core';

import { GuideService, TourPage } from './guide.service';
import { SpotlightPathService } from './spotlight-path.service';

/**
 * Marks one anchor of a page's spotlight path: the page it belongs to, the step it is (see GUIDE_PATHS) and, when the
 * words depend on the account, a variant such as "empty". Leave the page or the step empty to leave the anchor alone.
 * The path service decides when the path runs, so an anchor only has to say what and where it is.
 */
@Directive({ selector: '[appSpotlight]' })
export class SpotlightDirective implements OnInit {
  readonly appSpotlight = input<TourPage | null>(null);
  readonly spotlightStep = input('');
  readonly spotlightVariant = input('');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly guide = inject(GuideService);
  private readonly path = inject(SpotlightPathService);

  constructor() {
    effect((onCleanup) => {
      const page = this.appSpotlight();
      const step = this.spotlightStep();
      if (!page || !step) {
        return;
      }
      const unregister = this.path.register({ page, step, element: this.host.nativeElement, variant: () => this.spotlightVariant() });
      onCleanup(unregister);
    });
  }

  ngOnInit(): void {
    if (this.appSpotlight()) {
      this.guide.start();
    }
  }
}
