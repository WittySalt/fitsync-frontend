import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { DAY_KIND_GLYPHS } from '../../dashboard/brief/day-kind-icons';
import { GlyphShape } from '../../dashboard/brief/muscle-icons';
import { CalendarDay } from '../training/training.models';
import { hostWidth } from './host-width';
import { logGeometry } from './training-figures';

/**
 * The 28-day log (board 21a): four week rows of rounded tiles. A trained day is filled in its kind's
 * colour with the kind's glyph over the day number, and a small white dot on a record day; a day
 * without training is a quiet tile with its number, today has an ink outline and a day to come a
 * dashed one. A picture only; the card around it is the link.
 */
@Component({
  selector: 'app-log-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = geometry();
    <svg [attr.width]="width()" [attr.height]="g.height" [attr.viewBox]="'0 0 ' + width() + ' ' + g.height" role="img" [attr.aria-label]="label()">
      @for (initial of g.initials; track $index) {
        <text class="t12" text-anchor="middle" [attr.x]="48 + $index * g.pitch + g.pitch / 2" y="12">{{ initial }}</text>
      }
      @for (week of g.weeks; track week.label) {
        <text class="t12" x="0" [attr.y]="week.y + 4">{{ week.label }}</text>
      }
      @for (cell of g.cells; track cell.date) {
        @let left = cell.x - g.tile / 2;
        @let top = cell.y - g.tile / 2;
        @if (cell.kind) {
          <rect [class]="'tile ' + cell.kind.toLowerCase()" [class.today]="cell.today" [attr.x]="left" [attr.y]="top" [attr.width]="g.tile" [attr.height]="g.tile" rx="10"></rect>
          <svg class="glyph" [attr.x]="cell.x - 7" [attr.y]="top + 4" width="14" height="14" viewBox="0 0 24 24">
            @for (part of glyph(cell.kind); track $index) {
              @switch (part.tag) {
                @case ('path') { <path [attr.d]="part.d"></path> }
                @case ('circle') { <circle [attr.cx]="part.cx" [attr.cy]="part.cy" [attr.r]="part.r"></circle> }
                @case ('rect') { <rect [attr.x]="part.x" [attr.y]="part.y" [attr.width]="part.width" [attr.height]="part.height" [attr.rx]="part.rx"></rect> }
              }
            }
          </svg>
          <text class="num on" text-anchor="middle" [attr.x]="cell.x" [attr.y]="top + g.tile - 5">{{ cell.day }}</text>
          @if (cell.record) {
            <circle class="record" [attr.cx]="left + g.tile - 6" [attr.cy]="top + 6" r="3"></circle>
          }
        } @else {
          <rect [class]="cell.future ? 'tile rest future' : 'tile rest'" [class.today]="cell.today" [attr.x]="left" [attr.y]="top" [attr.width]="g.tile" [attr.height]="g.tile" rx="10"></rect>
          <text class="num" text-anchor="middle" [attr.x]="cell.x" [attr.y]="cell.y + 4">{{ cell.day }}</text>
        }
      }
    </svg>
  `,
  styleUrl: './log-strip.component.scss'
})
export class LogStripComponent {
  readonly to = input.required<string>();
  readonly days = input.required<readonly CalendarDay[]>();
  readonly label = input('');

  protected readonly width = hostWidth(300);
  protected readonly geometry = computed(() => logGeometry(this.to(), this.days(), this.width()));

  protected glyph(kind: string): GlyphShape[] {
    return DAY_KIND_GLYPHS[kind as keyof typeof DAY_KIND_GLYPHS] ?? [];
  }
}
