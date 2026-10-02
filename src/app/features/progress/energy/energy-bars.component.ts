import { Component, computed, input } from '@angular/core';

import { EnergyWeek } from './energy.models';
import { barsSummary, energyBars } from './energy-figures';

/**
 * The two bars on one scale: what was eaten, split by meal, over what was used, split into resting
 * and workouts, with a bracket under the gap and its words ("241 under").
 */
@Component({
  selector: 'app-energy-bars',
  template: `
    @if (bars(); as data) {
      <div class="bars" role="img" [attr.aria-label]="summary()">
        <div class="caption"><span>Eaten a day</span><strong>{{ total(data.eatenTotal) }} kcal</strong></div>
        <div class="bar">
          @for (part of data.eaten; track part.key) {
            <span class="seg" [attr.data-part]="part.key" [style.width.%]="part.percent" [attr.title]="part.label + ' ' + total(part.value)">
              @if (part.showLabel) {
                <span class="in">{{ part.label }} {{ total(part.value) }}</span>
              }
            </span>
          }
        </div>
        <div class="key">
          @for (part of data.eaten; track part.key) {
            <span><i [attr.data-part]="part.key"></i>{{ part.label }} {{ total(part.value) }}</span>
          }
        </div>
        <div class="caption used-caption"><span>Used a day</span><strong>{{ total(data.usedTotal) }} kcal</strong></div>
        <div class="bar">
          @for (part of data.used; track part.key) {
            <span class="seg" [attr.data-part]="part.key" [style.width.%]="part.percent" [attr.title]="part.label + ' ' + total(part.value)">
              @if (part.showLabel) {
                <span class="in">{{ part.label }} {{ total(part.value) }}</span>
              }
            </span>
          }
        </div>
        <div class="key">
          @for (part of data.used; track part.key) {
            <span><i [attr.data-part]="part.key"></i>{{ part.label }} {{ total(part.value) }}</span>
          }
        </div>
        @if (data.bracket; as gap) {
          <div class="gap">
            <span class="bracket" [style.left.%]="gap.left" [style.width.%]="gap.width"></span>
            <span class="words" [attr.data-align]="gap.align" [style.left.%]="gap.align === 'center' ? gap.left + gap.width / 2 : null">{{ gap.label }}</span>
          </div>
        }
      </div>
    }
  `,
  styleUrl: './energy-bars.component.scss'
})
export class EnergyBarsComponent {
  readonly week = input.required<EnergyWeek>();

  protected readonly bars = computed(() => energyBars(this.week()));
  protected readonly summary = computed(() => {
    const data = this.bars();
    return data ? barsSummary(data) : '';
  });

  protected total(value: number): string {
    return Math.round(value).toLocaleString('en-GB');
  }
}
