import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DAY_KIND_GLYPHS } from '../../../dashboard/brief/day-kind-icons';
import { TrainingKind } from '../training.models';

/** The kind's square tile with its white glyph, the same glyphs as the Home calendar. */
@Component({
  selector: 'app-kind-tile',
  template: `
    <span class="tile" [class]="'tile ' + kind().toLowerCase()" [style.width.px]="size()" [style.height.px]="size()" aria-hidden="true">
      <svg viewBox="0 0 24 24" [attr.width]="size() * 0.5" [attr.height]="size() * 0.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        @for (part of glyph(); track $index) {
          @switch (part.tag) {
            @case ('path') { <path [attr.d]="part.d"></path> }
            @case ('circle') { <circle [attr.cx]="part.cx" [attr.cy]="part.cy" [attr.r]="part.r"></circle> }
            @case ('rect') { <rect [attr.x]="part.x" [attr.y]="part.y" [attr.width]="part.width" [attr.height]="part.height" [attr.rx]="part.rx"></rect> }
          }
        }
      </svg>
    </span>
  `,
  styleUrl: './kind-tile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KindTileComponent {
  readonly kind = input.required<TrainingKind>();
  readonly size = input(36);

  protected readonly glyph = computed(() => DAY_KIND_GLYPHS[this.kind()] ?? DAY_KIND_GLYPHS.STRENGTH);
}
