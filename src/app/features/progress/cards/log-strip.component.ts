import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CalendarDay } from '../training/training.models';
import { hostWidth } from './host-width';
import { logGeometry } from './training-figures';

/**
 * The 28-day log: four week rows, each trained day a dot in its kind's colour and a small dark dot
 * on a record day. A picture only; the card around it is the link.
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
        @if (cell.kind) {
          <circle [class]="'day ' + cell.kind.toLowerCase()" [attr.cx]="cell.x" [attr.cy]="cell.y" [attr.r]="g.radius"></circle>
          @if (cell.record) {
            <circle class="record" [attr.cx]="cell.x + g.radius * 0.72" [attr.cy]="cell.y - g.radius * 0.72" r="3.5"></circle>
          }
        } @else {
          <circle [class]="cell.future ? 'rest future' : 'rest'" [attr.cx]="cell.x" [attr.cy]="cell.y" [attr.r]="g.radius"></circle>
        }
      }
      @for (item of key; track item.kind; let i = $index) {
        <circle [class]="'day ' + item.kind" [attr.cx]="54 + i * 82" [attr.cy]="g.keyY - 4" r="5"></circle>
        <text class="t12" [attr.x]="64 + i * 82" [attr.y]="g.keyY">{{ item.label }}</text>
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
  protected readonly key = [
    { kind: 'strength', label: 'Strength' },
    { kind: 'cardio', label: 'Cardio' },
    { kind: 'sport', label: 'Sport' }
  ];
}
