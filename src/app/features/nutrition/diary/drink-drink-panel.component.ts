import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { MealItemDraft } from '../../../core/fitsync.models';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { FoodIconComponent } from '../../../shared/food/food-icon.component';
import { MEAL_SLOTS } from '../../dashboard/today/today-meals';
import { DrinkDetail, DrinkOption } from './diary.models';
import { DRINK_SIZES, drinkItem, drinkPreview, loggedMoment } from './diary-water';
import { mealTypeByClock } from './diary-time';
import { DrinkWhenComponent } from './drink-when.component';
import { NutritionDiaryService } from './nutrition-diary.service';

const MAX_ML = 5000;
const MIN_QUERY = 2;

export interface DrinkAdd {
  item: MealItemDraft;
  at: Date;
  name: string;
}

interface PreviewPart {
  value: string;
  label: string;
  muted: boolean;
}

/** "Orange juice" as "orange juice" in a sentence, leaving a name that opens with capitals, such as "IPA", alone. */
export function inSentence(name: string): string {
  return /^[A-Z][a-z]/.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

/**
 * The Drink tab of the add dialog: find a drink among recent ones or by search, choose a size, see
 * what it adds, then add it. A drink with alcohol is logged with its kcal but never counts as water.
 */
@Component({
  selector: 'app-drink-drink-panel',
  imports: [FoodGlyphComponent, FoodIconComponent, DrinkWhenComponent],
  template: `
    <label class="search">
      <app-food-glyph name="SEARCH" [size]="18" [strokeWidth]="2" />
      <input type="search" placeholder="Search drinks" aria-label="Search drinks" [value]="query()" (input)="onQuery($event)" />
    </label>
    @if (recent().length) {
      <div class="recent">
        <span class="label">Recent</span>
        <div class="chips">
          @for (drink of recent(); track drink.foodId) {
            <button type="button" class="chip" [class.selected]="chosen()?.foodId === drink.foodId" (click)="pick(drink)">
              <app-food-icon group="DRINKS" [size]="24" />{{ drink.name }}
            </button>
          }
        </div>
      </div>
    }
    @if (searching()) {
      <p class="note" role="status">Searching.</p>
    } @else if (results().length) {
      <div class="results" role="listbox" aria-label="Drinks found">
        @for (drink of results(); track drink.foodId) {
          <button type="button" role="option" class="result" [class.selected]="chosen()?.foodId === drink.foodId" [attr.aria-selected]="chosen()?.foodId === drink.foodId" (click)="pick(drink)">
            <app-food-icon group="DRINKS" [size]="34" />
            <span class="result-text">
              <strong>{{ drink.name }}</strong>
              <span>{{ basis(drink) }}</span>
            </span>
          </button>
        }
      </div>
    } @else if (searched()) {
      <p class="note">No drinks found. Try another word.</p>
    }
    @if (detailError()) {
      <p class="hint" role="alert">That drink could not load. Choose it again to retry.</p>
    }
    @if (detail(); as drink) {
      <div class="sizes" role="group" aria-label="Size">
        @for (size of sizes; track size.label) {
          <button type="button" class="size" [class.selected]="sizeLabel() === size.label" [attr.aria-pressed]="sizeLabel() === size.label" (click)="chooseSize(size.label, size.ml)">
            <strong>{{ size.label }}</strong>
            <span>{{ size.ml ? size.ml + ' ml' : 'type it' }}</span>
          </button>
        }
      </div>
      @if (sizeLabel() === 'Other') {
        <label class="field">
          <span>Amount</span>
          <span class="input">
            <input type="number" inputmode="numeric" min="1" [max]="max" [value]="typed()" (input)="onType($event)" />
            <span class="unit">ml</span>
          </span>
        </label>
      }
      @if (parts().length) {
        <div class="preview">
          <span class="label">This drink adds</span>
          <div class="parts">
            @for (part of parts(); track part.label) {
              <div [class.muted]="part.muted"><strong>{{ part.value }}</strong><span>{{ part.label }}</span></div>
            }
          </div>
          @if (alcohol()) {
            <p>Drinks with alcohol are logged with their kcal but do not count towards water.</p>
          }
        </div>
      }
      <app-drink-when [date]="date()" [today]="today()" [opened]="opened()" [note]="'counts in ' + slotName()" [(clock)]="clock" />
      <button class="add" type="button" [disabled]="!canAdd() || busy()" (click)="submit(drink)">Add {{ sentence(drink.displayName) }}</button>
    }
  `,
  styleUrls: ['./drink-panels.scss', './drink-drink-panel.component.scss']
})
export class DrinkDrinkPanelComponent implements OnInit {
  private readonly service = inject(NutritionDiaryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly date = input.required<string>();
  readonly today = input.required<string>();
  readonly opened = input.required<Date>();
  readonly busy = input(false);
  readonly add = output<DrinkAdd>();

  protected readonly sizes = DRINK_SIZES;
  protected readonly max = MAX_ML;
  protected readonly query = signal('');
  protected readonly recent = signal<DrinkOption[]>([]);
  protected readonly results = signal<DrinkOption[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly chosen = signal<DrinkOption | null>(null);
  protected readonly detail = signal<DrinkDetail | null>(null);
  protected readonly detailError = signal(false);
  protected readonly sizeLabel = signal('Small');
  protected readonly typed = signal('');
  protected readonly clock = signal('');
  private readonly queries = new Subject<string>();
  // Starts as the Small size, to match sizeLabel.
  private readonly sizeMl = signal<number | null>(250);

  protected readonly amountMl = computed(() => {
    const preset = this.sizeMl();
    if (preset !== null) {
      return preset;
    }
    const text = this.typed().trim();
    return text === '' ? Number.NaN : Number(text);
  });
  private readonly preview = computed(() => {
    const drink = this.detail();
    return drink ? drinkPreview(drink, this.amountMl()) : null;
  });
  protected readonly alcohol = computed(() => (this.preview()?.alcoholGrams ?? null) !== null);
  protected readonly parts = computed<PreviewPart[]>(() => {
    const preview = this.preview();
    if (!preview) {
      return [];
    }
    const parts: PreviewPart[] = [];
    if (preview.alcoholGrams !== null) {
      parts.push({ value: '0 ml', label: 'towards water', muted: true });
    } else if (preview.waterMl !== null) {
      parts.push({ value: `+ ${preview.waterMl} ml`, label: 'towards water', muted: false });
    }
    parts.push({ value: String(preview.calories), label: 'kcal', muted: false });
    if (preview.alcoholGrams !== null) {
      parts.push({ value: `${preview.alcoholGrams} g`, label: 'alcohol', muted: false });
    } else if (preview.sugarGrams !== null) {
      parts.push({ value: `${preview.sugarGrams} g`, label: 'sugar', muted: false });
    }
    return parts;
  });
  protected readonly canAdd = computed(() => {
    const ml = this.amountMl();
    return this.detail() !== null && this.preview() !== null && Number.isFinite(ml) && ml >= 1 && ml <= MAX_ML;
  });
  protected readonly slotName = computed(() => {
    const at = loggedMoment(this.date(), this.clock(), this.today(), this.opened());
    return MEAL_SLOTS.find((slot) => slot.key === mealTypeByClock(at))?.label ?? 'Snack';
  });
  protected readonly sentence = inSentence;

  constructor() {
    this.queries
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((query) => {
          if (query.trim().length < MIN_QUERY) {
            this.searching.set(false);
            this.searched.set(false);
            return of([] as DrinkOption[]);
          }
          this.searching.set(true);
          return this.service.searchDrinks(query.trim()).pipe(catchError(() => of([] as DrinkOption[])));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((options) => {
        this.results.set(options);
        if (this.query().trim().length >= MIN_QUERY) {
          this.searched.set(true);
        }
        this.searching.set(false);
      });
  }

  ngOnInit(): void {
    this.service
      .recentDrinks()
      .pipe(catchError(() => of([] as DrinkOption[])))
      .subscribe((drinks) => this.recent.set(drinks));
  }

  protected basis(drink: DrinkOption): string {
    return [drink.basisLabel ? `per ${drink.basisLabel}` : '', `${Math.round(drink.calories)} kcal`].filter(Boolean).join(' · ');
  }

  protected onQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.queries.next(value);
  }

  protected pick(drink: DrinkOption): void {
    this.chosen.set(drink);
    this.detail.set(null);
    this.detailError.set(false);
    this.service.getDrinkDetail(drink.foodId).subscribe({
      next: (detail) => {
        if (this.chosen()?.foodId === drink.foodId) {
          this.detail.set(detail);
        }
      },
      error: () => this.detailError.set(true)
    });
  }

  protected chooseSize(label: string, ml: number | null): void {
    this.sizeLabel.set(label);
    this.sizeMl.set(ml);
  }

  protected onType(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  protected submit(drink: DrinkDetail): void {
    const ml = this.amountMl();
    const item = this.canAdd() ? drinkItem(drink, ml) : null;
    if (item && !this.busy()) {
      this.add.emit({ item, at: loggedMoment(this.date(), this.clock(), this.today(), new Date()), name: drink.displayName });
    }
  }
}
