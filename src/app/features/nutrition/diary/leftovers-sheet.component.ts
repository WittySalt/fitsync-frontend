import { Component, ElementRef, HostListener, Injector, afterNextRender, computed, inject, input, output, viewChild } from '@angular/core';

import { Leftover } from '../../../core/fitsync.models';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { dateKeyInZone } from '../../../core/zone-time';
import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { whole } from './diary-figures';
import { parseIsoDate } from './diary-time';

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

/** "Cooked today", "Cooked yesterday" or "Cooked Friday", from the cook's instant and today's date
 *  key, both read as calendar days in the profile zone. */
export function cookedWhen(cookedAt: string, today: string, timezone: string): string {
  const instant = new Date(cookedAt);
  if (Number.isNaN(instant.getTime())) {
    return 'Cooked recently';
  }
  const day = dateKeyInZone(instant, timezone);
  // Rounded, so a day that is 23 or 25 hours long around a clock change still counts as one.
  const gap = Math.round((parseIsoDate(today).getTime() - parseIsoDate(day).getTime()) / 86_400_000);
  return gap <= 0 ? 'Cooked today' : gap === 1 ? 'Cooked yesterday' : `Cooked ${WEEKDAY.format(parseIsoDate(day))}`;
}

/**
 * What is left from the last week's cooks, as a dialog on a computer and a sheet on a phone. One tap
 * on a row logs one serving into the meal the Add menu was opened from. The page does the saving.
 */
@Component({
  selector: 'app-leftovers-sheet',
  imports: [FoodGlyphComponent],
  template: `
    <div class="backdrop" (click)="closed.emit()" aria-hidden="true"></div>
    <div #panel class="panel" role="dialog" aria-modal="true" aria-labelledby="leftovers-title" tabindex="-1">
      <span class="grabber" aria-hidden="true"></span>
      <div class="head">
        <h2 id="leftovers-title">Leftovers for {{ mealLabel().toLowerCase() }}</h2>
        <button class="close" type="button" aria-label="Close" (click)="closed.emit()">
          <app-food-glyph name="CLOSE" [size]="18" [strokeWidth]="2.2" />
        </button>
      </div>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (rows().length) {
        <ul class="rows">
          @for (row of rows(); track row.cookId) {
            <li>
              <button type="button" class="row" [disabled]="busy()" [attr.aria-label]="'Log one serving of ' + row.name" (click)="eat.emit(row)">
                <span class="text">
                  <strong>{{ row.name }}</strong>
                  <span class="when">{{ row.when }}</span>
                </span>
                <span class="left">
                  <strong>{{ row.servingsLeft }} left</strong>
                  @if (row.kcal) {
                    <span class="when">{{ row.kcal }} kcal a serving</span>
                  }
                </span>
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="none">Nothing is left from the last 7 days.</p>
      }
    </div>
  `,
  styleUrl: './leftovers-sheet.component.scss'
})
export class LeftoversSheetComponent {
  private readonly userTimezone = inject(UserTimezoneService);

  readonly leftovers = input.required<readonly Leftover[]>();
  /** The meal one serving goes into, "Dinner". */
  readonly mealLabel = input.required<string>();
  readonly today = input.required<string>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly eat = output<Leftover>();

  protected readonly rows = computed(() =>
    this.leftovers().map((row) => ({ ...row, when: cookedWhen(row.cookedAt, this.today(), this.userTimezone.zone()), kcal: row.kcalPerServing === null ? '' : whole(row.kcalPerServing) }))
  );
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    afterNextRender(() => this.panel()?.nativeElement.focus(), { injector: inject(Injector) });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.closed.emit();
  }
}
