import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

import { EnergyWeekPoint } from './energy.models';
import { logVsScale, weeksChart, weeksSummary } from './energy-figures';
import { observeWidth } from './energy-width';

const FALLBACK_WIDTH = 600;
const HEIGHT = 110;

/**
 * The last eight weeks: the kilograms the food log adds up to (dashed, with dots) against the
 * kilograms on the scale (solid). Days without a food log are not counted, which the note says.
 */
@Component({
  selector: 'app-energy-weeks',
  template: `
    <div class="head">
      <strong>The last 8 weeks</strong>
      @if (figures(); as f) {
        <span class="says">
          @for (part of says(); track part.lead) {
            <span>{{ part.lead }}</span>
            @if (part.value) {
              <strong>{{ part.value }}</strong>
            }
          }
        </span>
      }
    </div>
    <svg class="chart" [attr.width]="width()" [attr.height]="height" [attr.viewBox]="'0 0 ' + width() + ' ' + height" role="img" [attr.aria-label]="text()" focusable="false">
      <line class="zero" x1="0" [attr.x2]="width()" [attr.y1]="chart().zeroY" [attr.y2]="chart().zeroY"></line>
      @for (path of chart().actual; track $index) {
        <path class="actual" [attr.d]="path"></path>
      }
      @for (dot of chart().actualDots; track $index) {
        <circle class="solo" [attr.cx]="dot.x" [attr.cy]="dot.y" r="3"></circle>
      }
      <path class="expected" [attr.d]="chart().expected"></path>
      @for (dot of chart().expectedDots; track $index) {
        <circle class="dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="3.5"></circle>
      }
    </svg>
    <div class="ends"><span>8 weeks ago</span><span>this week</span></div>
    <div class="key">
      <span><i class="dashed"></i>From your food log</span>
      <span><i class="solid"></i>On the scale</span>
    </div>
    <span class="note">Days without a food log are not counted, so the log can read low.</span>
  `,
  styleUrl: './energy-weeks.component.scss'
})
export class EnergyWeeksComponent {
  readonly weeks = input.required<EnergyWeekPoint[]>();

  protected readonly height = HEIGHT;
  protected readonly width = signal(FALLBACK_WIDTH);
  protected readonly chart = computed(() => weeksChart(this.weeks(), this.width(), HEIGHT));
  protected readonly figures = computed(() => logVsScale(this.weeks()));
  /** "Log says -1.9 kg, scale says -3.0 kg", with the figures set apart so they can be bold. */
  protected readonly says = computed(() => {
    const f = this.figures();
    if (!f) {
      return [];
    }
    if (f.log && f.scale) {
      return [
        { lead: 'Log says ', value: f.log },
        { lead: ', scale says ', value: f.scale }
      ];
    }
    return f.log ? [{ lead: 'Log says ', value: f.log }, { lead: ', no weigh-ins yet', value: '' }] : [{ lead: 'Scale says ', value: f.scale ?? '' }];
  });
  protected readonly text = computed(() => weeksSummary(this.figures()));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.destroyRef.onDestroy(observeWidth(this.host.nativeElement, (width) => this.width.set(width))));
  }
}
