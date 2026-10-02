import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EnergyDialComponent } from './energy-dial.component';
import { EnergyBarsComponent } from './energy-bars.component';
import { EnergyWeek } from './energy.models';
import { headline, subLine } from './energy-figures';

/**
 * The top of the energy card: the dial beside the big number, its sub line and the two bars. The
 * number reads the same under and over, in the same colours, since neither is a warning.
 */
@Component({
  selector: 'app-energy-top',
  imports: [EnergyBarsComponent, EnergyDialComponent, RouterLink],
  template: `
    <app-energy-dial class="dial" [balance]="balance()" />
    <div class="right">
      <div class="figure">
        <div class="number">
          <strong class="value">{{ words().value }}</strong>&ngsp;<span class="unit">{{ words().unit }}</span>
        </div>
        <span class="sub">{{ sub() }}</span>
        @if (week().bmrEstimated) {
          <span class="estimated">
            Estimated without your age or sex. Add them in <a routerLink="/me">Me</a> for a closer figure.
          </span>
        }
      </div>
      <app-energy-bars [week]="week()" />
    </div>
  `,
  styleUrl: './energy-top.component.scss'
})
export class EnergyTopComponent {
  readonly week = input.required<EnergyWeek>();

  protected readonly balance = computed(() => this.week().average?.balance ?? 0);
  protected readonly words = computed(() => headline(this.balance()));
  protected readonly sub = computed(() => subLine(this.week()));
}
