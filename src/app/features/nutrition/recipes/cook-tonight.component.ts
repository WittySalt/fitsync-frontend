import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { CoachStore } from '../../../core/coach/coach.store';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { LOADING, Load } from '../diary/diary.models';
import { COOK_CARD_PREFILL, SUGGESTIONS_ERROR, TOMORROW_QUESTION, cookChips, cookHeadline, dinnerLine } from './cook-tonight';
import { RecipeCoverComponent } from './recipe-cover.component';
import { RecipeReadyComponent } from './recipe-ready.component';
import { RecipeSuggestion, RecipeSuggestions } from './recipes.models';

const LIMIT = 3;
const NO_GROUPS: never[] = [];

/**
 * "Cook for tonight": the Diary reading card's look, on the Recipes tab. It reads the day's state
 * from the suggestions endpoint and shows the recipes that suit it, each with the reason in one
 * sentence. A Cook button opens the Ready sheet. Once dinner is logged it folds to one row. A
 * failure is one quiet line, and the rest of the page does not wait for it.
 */
@Component({
  selector: 'app-cook-tonight',
  imports: [FoodGlyphComponent, RecipeCoverComponent, RecipeReadyComponent],
  template: `
    @let s = state();
    @if (s.status === 'loading') {
      <div class="skeleton card-skeleton" aria-busy="true" aria-label="Loading tonight's suggestions"></div>
    } @else if (s.status === 'error') {
      <section class="card" aria-label="Cook for tonight">
        <header class="head">
          <span class="mark" aria-hidden="true">C</span>
          <span class="eyebrow">Cook for tonight</span>
        </header>
        <p class="quiet" role="status">{{ errorLine }}</p>
      </section>
    } @else if (s.data.state === 'DINNER_LOGGED') {
      <section class="folded" aria-label="Cook for tonight">
        <span class="mark" aria-hidden="true">C</span>
        <span class="folded-line">{{ folded() }}</span>
        <button type="button" class="tomorrow" (click)="askTomorrow()">
          Tomorrow
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
        </button>
      </section>
    } @else {
      <section class="card" aria-labelledby="cook-tonight-headline">
        <header class="head">
          <span class="mark" aria-hidden="true">C</span>
          <span class="eyebrow">Cook for tonight</span>
          <button type="button" class="ask" aria-label="Ask the coach about tonight's recipes" (click)="ask()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z"></path></svg>
            Ask
          </button>
        </header>
        <h2 id="cook-tonight-headline">{{ headline() }}</h2>
        @if (chips().length > 0) {
          <ul class="chips" aria-label="What tonight looks like">
            @for (chip of chips(); track chip) {
              <li>{{ chip }}</li>
            }
          </ul>
        }
        @if (s.data.suggestions.length > 0) {
          <ul class="rows">
            @for (item of s.data.suggestions; track item.recipeId) {
              <li class="row">
                <app-recipe-cover [imageUrl]="item.imageUrl" [groups]="noGroups" [width]="56" [height]="56" [radius]="12" [glyph]="14" />
                <div class="text">
                  <strong>{{ item.name }}</strong>
                  <span class="figures">{{ figures(item) }}</span>
                  @if (item.reason) {
                    <span class="reason">{{ item.reason }}</span>
                  }
                </div>
                <button type="button" class="cook" [attr.aria-label]="'Cook ' + item.name" (click)="readyFor.set(item.recipeId)">
                  <app-food-glyph name="PLAY" [size]="13" [strokeWidth]="2.4" />Cook
                </button>
              </li>
            }
          </ul>
        }
      </section>
    }
    @if (readyFor(); as id) {
      <app-recipe-ready [recipeId]="id" (closed)="readyFor.set(null)" />
    }
  `,
  styleUrl: './cook-tonight.component.scss'
})
export class CookTonightComponent {
  private readonly data = inject(FitSyncDataService);
  private readonly coach = inject(CoachStore);

  protected readonly errorLine = SUGGESTIONS_ERROR;
  protected readonly noGroups = NO_GROUPS;
  protected readonly state = signal<Load<RecipeSuggestions>>(LOADING);
  protected readonly readyFor = signal<string | null>(null);

  protected readonly headline = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? cookHeadline(s.data) : '';
  });
  protected readonly chips = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? cookChips(s.data) : [];
  });
  protected readonly folded = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? dinnerLine(s.data) : '';
  });

  constructor() {
    this.data
      .getRecipeSuggestions(LIMIT)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (data) => this.state.set({ status: 'ready', data }),
        error: () => this.state.set({ status: 'error', message: SUGGESTIONS_ERROR })
      });
  }

  protected figures(item: RecipeSuggestion): string {
    return `${Math.round(item.kcalPerServing)} kcal · ${Math.round(item.proteinPerServing)} g protein`;
  }

  /** Opens the dock with the question in the composer. Nothing is sent until the person sends it. */
  protected ask(): void {
    this.coach.composerPrefill.set(COOK_CARD_PREFILL);
    this.coach.open();
  }

  protected askTomorrow(): void {
    this.coach.open();
    this.coach.ask(TOMORROW_QUESTION);
  }
}
