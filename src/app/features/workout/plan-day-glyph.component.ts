import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DayKind } from '../../core/fitsync.models';
import { DAY_KIND_GLYPHS } from '../dashboard/brief/day-kind-icons';

/** The glyph of a day kind, drawn from the shared glyph data with attribute bindings. It takes the
 *  colour of its parent through `currentColor`, so a tile decides how the glyph looks. */
@Component({
  selector: 'app-plan-day-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }

    svg {
      display: block;
      flex: none;
    }
  `,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @for (part of shapes(); track $index) {
        @switch (part.tag) {
          @case ('path') {
            <path [attr.d]="part.d"></path>
          }
          @case ('circle') {
            <circle [attr.cx]="part.cx" [attr.cy]="part.cy" [attr.r]="part.r"></circle>
          }
          @case ('rect') {
            <rect [attr.x]="part.x" [attr.y]="part.y" [attr.width]="part.width" [attr.height]="part.height" [attr.rx]="part.rx"></rect>
          }
        }
      }
    </svg>
  `
})
export class PlanDayGlyphComponent {
  readonly kind = input.required<DayKind>();
  readonly size = input(22);

  protected readonly shapes = computed(() => DAY_KIND_GLYPHS[this.kind()]);
}
