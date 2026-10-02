import { Component, computed, input, model, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MEAL_SLOTS } from '../../dashboard/today/today-meals';
import { Load } from '../diary/diary.models';
import { whole } from '../diary/diary-figures';
import { FitTodayComponent } from './fit-today.component';
import { MAX_SERVINGS, MIN_SERVINGS, TodayFit, scaled, servingsLabel, stepServings } from './recipes-figures';
import { RecipeDetail } from './recipes.models';

/**
 * "Eat this": what the servings do to today, a stepper for the servings, the meal to log under, and
 * the actions: log, start cooking, save or make it mine (or edit, for a recipe of the person's own),
 * and add to a saved meal. The card holds no data of its own; the page carries out each action.
 */
@Component({
  selector: 'app-eat-card',
  imports: [FitTodayComponent, RouterLink],
  template: `
    <h3>Eat this</h3>
    <app-fit-today [state]="fit()" [servings]="servings()" />
    <div class="row">
      <span class="label">Servings</span>
      <span class="stepper">
        <button type="button" aria-label="Fewer servings" [disabled]="servings() <= min" (click)="step(-1)">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
        <strong aria-live="polite">{{ servings() }} of {{ recipe().servings }}</strong>
        <button type="button" aria-label="More servings" [disabled]="servings() >= max" (click)="step(1)">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </span>
    </div>
    <div class="row meal">
      <span>{{ slotLabel() }}, now</span>
      <button class="link" type="button" [attr.aria-expanded]="changing()" (click)="changing.set(!changing())">Change</button>
    </div>
    @if (changing()) {
      <div class="slots" role="group" aria-label="Meal">
        @for (slot of slots; track slot.key) {
          <button type="button" [class.on]="slot.key === mealType()" [attr.aria-pressed]="slot.key === mealType()" (click)="pick(slot.key)">{{ slot.label }}</button>
        }
      </div>
    }
    <button class="log" type="button" [disabled]="busy()" (click)="log.emit()">Log {{ label() }} · {{ kcal() }} kcal</button>
    <button class="cook" type="button" (click)="cook.emit()">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5Z" /></svg>Start cooking
    </button>
    <div class="pair">
      @if (recipe().editable) {
        <a class="small" [routerLink]="['/nutrition/recipes', recipe().id, 'edit']">Edit</a>
      } @else {
        <button class="small" type="button" [class.on]="recipe().favorite" [attr.aria-pressed]="recipe().favorite" (click)="favourite.emit()">
          <svg class="heart" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
          </svg>
          {{ recipe().favorite ? 'Saved' : 'Save' }}
        </button>
        <button class="small" type="button" [disabled]="busy()" (click)="makeMine.emit()">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M5 15V6a1 1 0 0 1 1-1h9" /></svg>
          Make it mine
        </button>
      }
    </div>
    <button class="link save-meal" type="button" (click)="addToSaved.emit()">Add to a saved meal</button>
  `,
  styleUrl: './eat-card.component.scss'
})
export class EatCardComponent {
  readonly recipe = input.required<RecipeDetail>();
  readonly fit = input.required<Load<TodayFit>>();
  /** The servings to eat, from 0.25 to 20. */
  readonly servings = model(1);
  /** The meal type to log under. */
  readonly mealType = model('LUNCH');
  readonly busy = input(false);
  readonly log = output<void>();
  /** Start cooking: the page opens the Ready screen. */
  readonly cook = output<void>();
  readonly favourite = output<void>();
  readonly makeMine = output<void>();
  readonly addToSaved = output<void>();

  protected readonly min = MIN_SERVINGS;
  protected readonly max = MAX_SERVINGS;
  protected readonly slots = MEAL_SLOTS;
  protected readonly changing = signal(false);
  protected readonly label = computed(() => servingsLabel(this.servings()));
  protected readonly kcal = computed(() => whole(scaled(this.recipe().perServing.kcal, this.servings())));
  protected readonly slotLabel = computed(() => MEAL_SLOTS.find((slot) => slot.key === this.mealType())?.label ?? 'Snack');

  protected step(direction: 1 | -1): void {
    this.servings.set(stepServings(this.servings(), direction));
  }

  protected pick(slot: string): void {
    this.mealType.set(slot);
    this.changing.set(false);
  }
}
