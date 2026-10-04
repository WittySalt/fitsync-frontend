import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { PlanDayGlyphComponent } from '../plan-day-glyph.component';
import { FLOW_KIND_LABELS, FLOW_KINDS, FlowKind } from './plan-draft';

/** The five kinds a day can be. Five tiles in a row, or three and two at narrow width. */
@Component({
  selector: 'app-plan-kind-tiles',
  imports: [PlanDayGlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './kind-tiles.component.scss',
  template: `
    <div class="tiles" role="group" aria-label="Kind of day">
      @for (kind of kinds; track kind) {
        <button
          type="button"
          class="tile"
          [class.on]="kind === current()"
          [attr.data-kind]="kind"
          [attr.aria-pressed]="kind === current()"
          (click)="choose.emit(kind)"
        >
          @if (kind === 'REST') {
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"></path>
            </svg>
          } @else {
            <app-plan-day-glyph [kind]="kind" />
          }
          <span>{{ labels[kind] }}</span>
        </button>
      }
    </div>
  `
})
export class KindTilesComponent {
  readonly current = input<FlowKind | null>(null);
  readonly choose = output<FlowKind>();

  protected readonly kinds = FLOW_KINDS;
  protected readonly labels = FLOW_KIND_LABELS;
}
