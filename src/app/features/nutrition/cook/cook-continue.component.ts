import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { RecipeCoverComponent } from '../recipes/recipe-cover.component';
import { clockText } from './cook-format';
import { CookSessionService } from './cook-session.service';
import { remainingSeconds, stageName } from './cook-timer';

/**
 * "Continue cooking", on the Recipes tab while a cook session is open and cook mode is not on
 * screen: the recipe, the step the cook is at, the timer that ends first, and the way back.
 * "Stop cooking" ends the session for good.
 */
@Component({
  selector: 'app-cook-continue',
  imports: [FoodGlyphComponent, RecipeCoverComponent],
  template: `
    @if (visible()) {
      @let data = session.data()!;
      <app-recipe-cover [imageUrl]="data.imageUrl" [groups]="[]" [width]="52" [height]="52" [radius]="12" [glyph]="14" />
      <div class="text">
        <span class="kicker">Continue cooking</span>
        <strong class="name">{{ data.name }}</strong>
        <span class="meta">{{ meta() }}</span>
      </div>
      <button type="button" class="stop" (click)="session.clear()">Stop cooking</button>
      <button type="button" class="resume" (click)="resume()">
        <app-food-glyph name="PLAY" [size]="14" [strokeWidth]="2.4" />Back to cooking
      </button>
    }
  `,
  styleUrl: './cook-continue.component.scss',
  host: { '[class.on]': 'visible()' }
})
export class CookContinueComponent {
  protected readonly session = inject(CookSessionService);
  private readonly router = inject(Router);

  protected readonly visible = computed(() => !!this.session.data() && !this.session.viewing() && this.session.hasProgress());
  protected readonly meta = computed(() => {
    const data = this.session.data();
    if (!data) {
      return '';
    }
    const step = `Step ${data.step + 1} of ${Math.max(data.stepCount, data.step + 1)}`;
    const next = this.session.liveTimers()[0];
    if (!next) {
      return step;
    }
    if (next.state.phase === 'turn') {
      return `${step} · time to turn it`;
    }
    const label = next.name !== null ? next.name || 'Timer' : (stageName(next.state) ?? 'Timer');
    const left = clockText(remainingSeconds(next.state, this.session.now()));
    return `${step} · ${label} ${left} left${next.state.phase === 'paused' ? ' (paused)' : ''}`;
  });

  protected resume(): void {
    const data = this.session.data();
    if (data) {
      void this.router.navigate(['/nutrition/recipes', data.recipeId, 'cook'], { queryParams: { servings: data.servings } });
    }
  }
}
