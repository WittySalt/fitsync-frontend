import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { clockText } from './cook-format';
import { CookSessionService } from './cook-session.service';
import { remainingSeconds, stageName } from './cook-timer';

const MAX_SHOWN = 2;

/**
 * The cooking in progress, fixed above the bottom navigation on the other pages, while a timer you
 * kept still runs or waits for you. It is a sibling of the Workout bar (app-workout-bar) with the
 * same look and place; the Workout bar is tied to the workout service, so it is not reused as is.
 * The Workout bar's own space variable moves this one up when both show.
 */
@Component({
  selector: 'app-cook-bar',
  templateUrl: './cook-bar.component.html',
  styleUrl: './cook-bar.component.scss'
})
export class CookBarComponent {
  private readonly session = inject(CookSessionService);
  private readonly router = inject(Router);

  protected readonly visible = computed(() => !this.session.viewing() && this.session.hasLive());
  protected readonly name = computed(() => this.session.data()?.name ?? '');
  protected readonly items = computed(() => {
    const now = this.session.now();
    return this.session
      .liveTimers()
      .slice(0, MAX_SHOWN)
      .map(({ step, state }) => {
        const label = stageName(state) ?? `Step ${step + 1}`;
        if (state.phase === 'turn') {
          return `Step ${step + 1}: turn it`;
        }
        const time = clockText(remainingSeconds(state, now));
        return `${label} ${time}${state.phase === 'paused' ? ' paused' : ''}`;
      });
  });
  protected readonly extra = computed(() => Math.max(0, this.session.liveTimers().length - MAX_SHOWN));
  protected readonly accessibleName = computed(() => `Back to cooking, ${this.name()}, ${this.items().join(', ')}`);

  protected resume(): void {
    const data = this.session.data();
    if (data) {
      void this.router.navigate(['/nutrition/recipes', data.recipeId, 'cook'], { queryParams: { servings: data.servings } });
    }
  }
}
