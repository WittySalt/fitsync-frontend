import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { liftChangePct } from '../lift-math';
import { Lift } from '../training.models';
import { kg, plural, shortDate, signedKg, signedPct } from '../training-format';
import { SeriesChartComponent } from './series-chart.component';

/**
 * One main lift: its estimated best single in Fraunces with the change, the series with records,
 * and the gain and best set under it. The whole card opens the exercise page.
 */
@Component({
  selector: 'app-lift-card',
  imports: [RouterLink, SeriesChartComponent],
  template: `
    <a class="lift" [routerLink]="link()" [attr.aria-label]="aria()">
      <div class="top">
        <strong class="name">{{ lift().name }}</strong>
        @if (change(); as text) {
          <span class="change">{{ text }}</span>
        }
      </div>
      @if (now() !== null) {
        <div class="figure">
          <strong>{{ now() }} kg</strong>
          <span>est. best single</span>
        </div>
      }
      <app-series-chart [points]="lift().e1rm" [bestBefore]="lift().bestBefore" [compact]="compact()" [label]="lift().name + ' estimated best single, ' + (now() ?? '') + ' kg'" />
      <span class="foot">{{ foot() }}</span>
    </a>
  `,
  styleUrl: './lift-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiftCardComponent {
  readonly lift = input.required<Lift>();
  readonly compact = input(false);

  protected readonly link = computed(() => ['/progress/training/exercises', this.lift().exerciseId || this.lift().name]);
  protected readonly now = computed(() => {
    const points = this.lift().e1rm;
    return points.length ? kg(points[points.length - 1].value) : null;
  });
  protected readonly change = computed(() => {
    const pct = liftChangePct(this.lift());
    return pct === null ? '' : signedPct(pct);
  });
  protected readonly foot = computed(() => {
    const lift = this.lift();
    const points = lift.e1rm;
    const records = points.filter((point) => point.isRecord).length;
    const parts: string[] = [];
    if (points.length > 1) {
      parts.push(`${signedKg(points[points.length - 1].value - points[0].value)} since ${shortDate(points[0].date)}.`);
    }
    const best = lift.bestSet ? `, best set ${kg(lift.bestSet.weightKg)} kg × ${lift.bestSet.reps}` : '';
    parts.push(`${plural(records, 'record')}${best}.`);
    return parts.join(' ');
  });
  protected readonly aria = computed(() => `${this.lift().name}, estimated best single ${this.now() ?? 'unknown'} kg ${this.change()}. Open the exercise.`);
}
