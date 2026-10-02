import { Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { FoodSearchResult } from '../../../core/fitsync.models';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { whole } from '../diary/diary-figures';

const DEBOUNCE_MS = 300;
const RESULT_COUNT = 8;
const QUERY_MAX = 80;

/** A box that searches the food catalogue as you type and offers the matches to add as an ingredient. */
@Component({
  selector: 'app-ingredient-picker',
  imports: [FoodGlyphComponent],
  template: `
    <label class="search">
      <app-food-glyph name="SEARCH" [size]="18" [strokeWidth]="2" />
      <input
        type="search"
        aria-label="Add an ingredient"
        placeholder="Add an ingredient"
        autocomplete="off"
        [attr.maxlength]="max"
        [value]="text()"
        (input)="onInput($event)"
      />
    </label>
    @if (searching()) {
      <p class="note" aria-busy="true">Searching</p>
    } @else if (text().trim() && results().length === 0) {
      <p class="note">No foods match that. Try another word.</p>
    } @else if (results().length) {
      <ul>
        @for (food of results(); track $index) {
          <li>
            <button type="button" (click)="choose(food)">
              <span class="name">{{ food.displayName }}</span>
              <span class="kcal">{{ kcal(food.calories) }} kcal a {{ food.basisLabel || '100 g' }}</span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './ingredient-picker.component.scss'
})
export class IngredientPickerComponent {
  private readonly data = inject(FitSyncDataService);
  private readonly typing = new Subject<string>();

  readonly pick = output<FoodSearchResult>();

  protected readonly max = QUERY_MAX;
  protected readonly text = signal('');
  protected readonly results = signal<FoodSearchResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly kcal = whole;

  constructor() {
    this.typing
      .pipe(
        map((value) => value.trim()),
        debounceTime(DEBOUNCE_MS),
        distinctUntilChanged(),
        tap((value) => this.searching.set(value.length > 0)),
        switchMap((value) => (value ? this.data.searchFoods(value, { size: RESULT_COUNT }) : of([] as FoodSearchResult[]))),
        takeUntilDestroyed()
      )
      .subscribe((foods) => {
        this.searching.set(false);
        this.results.set(foods);
      });
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.slice(0, QUERY_MAX);
    this.text.set(value);
    if (!value.trim()) {
      this.results.set([]);
    }
    this.typing.next(value);
  }

  protected choose(food: FoodSearchResult): void {
    this.pick.emit(food);
    this.text.set('');
    this.results.set([]);
    this.typing.next('');
  }
}
