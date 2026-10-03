import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The frame of a Progress detail page: the head, then the contents rail at the left (a sticky row
 * on phones) and the sections at the right. Project the head with `detailHead`, the rail with
 * `detailRail`, and the sections as the rest. The first section drops its top hairline.
 */
@Component({
  selector: 'app-detail-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <ng-content select="[detailHead]" />
      <div class="body">
        <ng-content select="[detailRail]" />
        <div class="sections"><ng-content /></div>
      </div>
    </main>
  `,
  styles: `
    :host { display: block; }
    .page { box-sizing: border-box; display: flex; flex-direction: column; gap: 28px; width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 0 48px; }
    .body { display: block; }
    .sections { display: flex; flex-direction: column; min-width: 0; }
    /* The sections are projected, so only ng-deep reaches the first one. */
    :host ::ng-deep .sections > :first-child { --section-rule: transparent; --section-pad-top: 24px; }
    @media (min-width: 1024px) {
      .body { display: grid; grid-template-columns: 200px minmax(0, 880px); gap: 40px; align-items: start; padding-top: 36px; border-top: 1px solid var(--border); }
      :host ::ng-deep .sections > :first-child { --section-pad-top: 0; }
    }
  `
})
export class DetailLayoutComponent {}
