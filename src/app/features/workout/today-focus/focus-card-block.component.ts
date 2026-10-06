import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { FocusCardBlock } from './today-focus';

/**
 * What a short Today card takes in from its companion: the sport day's usual weekday, the last four
 * of them and this month, or the rest day's remaining days of the week. It only draws.
 */
@Component({
  selector: 'app-focus-card-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (block(); as b) {
      @if (b.kind === 'sport') {
        <div class="block">
          @if (b.usual) {
            <p class="line">{{ b.usual }}</p>
          }
          @if (b.dots?.length) {
            <h4 class="heading">{{ b.dotsHeading }}</h4>
            <ol class="dots" aria-label="Played in the last four weeks">
              @for (dot of b.dots; track $index) {
                <li [class]="dot.state" [attr.aria-label]="dot.label + (dot.state === 'played' ? ', played' : ', not played')">
                  <i aria-hidden="true"></i>
                  <span>{{ dot.label }}</span>
                </li>
              }
            </ol>
          }
          @if (b.month) {
            <p class="line">{{ b.month }}</p>
          }
        </div>
      } @else if (b.week?.length) {
        <div class="block">
          <h4 class="heading">{{ b.weekHeading }}</h4>
          <ul class="week">
            @for (day of b.week; track $index) {
              <li>
                <strong class="day">{{ day.weekday }}</strong>
                <span class="title">{{ day.title }}</span>
                <span class="mins">{{ day.minutes }}</span>
              </li>
            }
          </ul>
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .block { display: flex; flex-direction: column; gap: 12px; }
    .line { margin: 0; font-size: 14px; color: var(--text-secondary); }
    .heading { margin: 0; font-size: 11px; font-weight: var(--fw-bold); letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); }
    .dots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; list-style: none; }
    .dots li { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; color: var(--text-secondary); }
    .dots i { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid var(--border-strong); }
    .dots .played i { background: var(--accent); border-color: var(--accent); }
    .week { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .week li { display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface-sunken); font-size: 14px; }
    .day { width: 32px; font-size: 12px; color: var(--text-secondary); }
    .title { flex: 1 1 0; font-weight: var(--fw-semibold); }
    .mins { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  `
})
export class FocusCardBlockComponent {
  readonly block = input<FocusCardBlock | null>(null);
}
