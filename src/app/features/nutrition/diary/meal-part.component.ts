import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { groupForCategory } from '../../../shared/food/food-groups';
import { UsualMeal } from '../../../core/fitsync.models';
import { FoodRowComponent } from './food-row.component';
import { RecipeRowComponent } from './recipe-row.component';
import { DiaryRow, MealPart, diaryRows, macroSplit } from './diary-food';
import { SpotlightDirective } from '../../../core/guide/spotlight.directive';
import { AddSource } from './diary.models';
import { whole } from './diary-figures';

/** The names of a usual meal as a sentence: at most three, otherwise two and how many more. */
export function usualNames(meal: UsualMeal): string {
  const names = meal.items.map((entry) => entry.name).filter(Boolean);
  if (names.length <= 3) {
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');
  }
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/**
 * One part of the meals card. It shows the meal's time and kcal, a thin split of protein carbs and
 * fat, its foods, and a menu. A part with nothing logged offers the person's usual meal instead.
 * Edit is left out of the menu until the meal builder can open an existing meal.
 */
@Component({
  selector: 'app-meal-part',
  imports: [FoodRowComponent, FoodGlyphComponent, FoodIconComponent, RecipeRowComponent, SpotlightDirective],
  template: `
    <div class="head">
      <div class="title">
        <div class="name-line">
          <h3>{{ part().label }}</h3>
          <span class="sub">{{ sub() }}</span>
        </div>
        @if (split(); as parts) {
          <span class="split" role="img" aria-label="Protein, carbs and fat">
            <i [style.flex-grow]="parts.protein" style="background: var(--food-protein)"></i>
            <i [style.flex-grow]="parts.carbs" style="background: var(--food-grains)"></i>
            <i [style.flex-grow]="parts.fat" style="background: var(--food-nuts)"></i>
          </span>
        }
      </div>
      <div class="actions">
        <span class="more-wrap">
          <button
            class="add"
            type="button"
            [appSpotlight]="tourAnchor() ? 'nutrition' : null"
            spotlightStep="log"
            aria-haspopup="menu"
            [attr.aria-expanded]="addMenuOpen()"
            [disabled]="busy()"
            (click)="toggleAddMenu($event)"
          >
            <app-food-glyph name="PLUS" [size]="14" [strokeWidth]="2.6" />Add
          </button>
          @if (addMenuOpen()) {
            <div class="menu add-menu" role="menu" [attr.aria-label]="'Add to ' + part().label">
              <button type="button" role="menuitem" (click)="chooseAdd('search')">Search foods</button>
              <button type="button" role="menuitem" (click)="chooseAdd('recipes')">From recipes</button>
              <button type="button" role="menuitem" (click)="chooseAdd('saved')">From saved meals</button>
              <button type="button" role="menuitem" class="with-badge" (click)="chooseAdd('leftovers')">
                Leftovers
                @if (leftoverCount() > 0) {
                  <span class="badge" [attr.aria-label]="leftoverCount() + ' servings left'">{{ leftoverCount() }}</span>
                }
              </button>
              <button type="button" role="menuitem" (click)="chooseAdd('quick')">Quick add</button>
            </div>
          }
        </span>
        @if (part().logged) {
          <span class="more-wrap">
            <button
              class="more"
              type="button"
              aria-haspopup="menu"
              [attr.aria-expanded]="menuOpen()"
              [attr.aria-label]="'More for ' + part().label"
              [disabled]="busy()"
              (click)="toggleMenu($event)"
            >
              <app-food-glyph name="MORE" [size]="18" [strokeWidth]="2.4" />
            </button>
            @if (menuOpen()) {
              <div class="menu" role="menu">
                <button type="button" role="menuitem" (click)="choose('log')">Log again now</button>
                <button type="button" role="menuitem" (click)="choose('save')">Save as a meal</button>
                <button class="delete" type="button" role="menuitem" (click)="choose('delete')">Delete</button>
              </div>
            }
          </span>
        } @else {
          <span class="more-gap"></span>
        }
      </div>
    </div>
    @if (part().logged) {
      <div class="rows">
        @for (row of rows(); track $index) {
          @if (row.kind === 'recipe') {
            <app-recipe-row [row]="row" />
          } @else {
            <app-food-row [item]="row.item" />
          }
        }
      </div>
    } @else if (usual(); as meal) {
      <div class="usual">
        <span class="icons">
          @for (entry of meal.items.slice(0, 2); track $index) {
            <app-food-icon [group]="groupOf(entry.categoryCode)" [categoryCode]="entry.categoryCode" [size]="30" />
          }
        </span>
        <div class="usual-text">
          <span class="usual-label">Your usual {{ part().label.toLowerCase() }}</span>
          <span class="usual-line">
            <strong>{{ names(meal) }}</strong>
            @if (meal.totalCalories !== null) {
              · {{ kcal(meal.totalCalories) }} kcal
            }
          </span>
        </div>
        <button class="log-it" type="button" [disabled]="busy()" (click)="logUsual.emit(meal)">Log it</button>
      </div>
    }
  `,
  styleUrl: './meal-part.component.scss'
})
export class MealPartComponent {
  readonly part = input.required<MealPart>();
  /** The person's usual meal for this part, when they have one. */
  readonly usual = input<UsualMeal | null>(null);
  readonly busy = input(false);
  /** Servings left from the last week's cooks, shown as a badge on the Leftovers entry. */
  readonly leftoverCount = input(0);
  /** True for the first meal of the card, which carries the Nutrition spotlight. */
  readonly tourAnchor = input(false);
  /** Search foods, the first entry of the Add menu. */
  readonly add = output<void>();
  /** The other entries of the Add menu. */
  readonly addFrom = output<AddSource>();
  readonly logAgain = output<void>();
  readonly saveAsMeal = output<void>();
  readonly deleteMeal = output<void>();
  readonly logUsual = output<UsualMeal>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly menuOpen = signal(false);
  protected readonly addMenuOpen = signal(false);

  protected readonly sub = computed(() => {
    const part = this.part();
    if (!part.logged) {
      return 'Nothing logged yet';
    }
    return `${part.time ? part.time + ' · ' : ''}${whole(part.calories)} kcal`;
  });
  protected readonly split = computed(() => {
    const part = this.part();
    return part.logged ? macroSplit(part.proteinGrams, part.carbsGrams, part.fatGrams) : null;
  });

  protected readonly rows = computed<DiaryRow[]>(() => diaryRows(this.part().meals));
  protected readonly groupOf = groupForCategory;
  protected readonly names = usualNames;
  protected readonly kcal = whole;

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.addMenuOpen.set(false);
    this.menuOpen.update((open) => !open);
  }

  protected toggleAddMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.addMenuOpen.update((open) => !open);
  }

  protected chooseAdd(source: AddSource | 'search'): void {
    this.addMenuOpen.set(false);
    if (source === 'search') {
      this.add.emit();
    } else {
      this.addFrom.emit(source);
    }
  }

  protected choose(action: 'log' | 'save' | 'delete'): void {
    this.menuOpen.set(false);
    if (action === 'log') {
      this.logAgain.emit();
    } else if (action === 'save') {
      this.saveAsMeal.emit();
    } else {
      this.deleteMeal.emit();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    if ((this.menuOpen() || this.addMenuOpen()) && !this.host.nativeElement.contains(event.target as Node)) {
      this.menuOpen.set(false);
      this.addMenuOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen.set(false);
    this.addMenuOpen.set(false);
  }
}
