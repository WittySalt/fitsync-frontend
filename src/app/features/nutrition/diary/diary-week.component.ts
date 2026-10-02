import { Component, computed, input, output } from '@angular/core';

import { RangeDay } from './diary.models';
import { dayTiles, DayTile, weekFigures } from './diary-week';
import { rangeLabel } from './diary-time';
import { whole } from './diary-figures';

/**
 * The head of the Nutrition page in one card, like the Workout page's: the seven days of this week
 * filled by calories over target, days logged, days on target and kcal a day. A day opens in the Diary.
 */
@Component({
  selector: 'app-diary-week',
  template: `
    <div class="head">
      <span class="eyebrow">This week</span>
      <span class="range">{{ range() }}</span>
    </div>
    @if (failed()) {
      <div class="failed" role="alert">
        <span>The week could not load.</span>
        <button type="button" (click)="retry.emit()">Retry</button>
      </div>
    } @else {
      <div class="body">
        <ol class="days" aria-label="This week">
          @for (tile of tiles(); track tile.date) {
            <li>
              <button
                class="day"
                type="button"
                [class.selected]="tile.date === selected()"
                [attr.aria-pressed]="tile.date === selected()"
                [attr.aria-label]="describe(tile)"
                (click)="pick.emit(tile.date)"
              >
                <span class="weekday" [class.now]="tile.state === 'today'">{{ tile.weekday }}</span>
                <span class="tile" [class]="'tile ' + tile.state" [class.logged]="tile.logged">
                  <span class="fill" [style.height.%]="tile.fill * 100"></span>
                </span>
                <span class="caption" [class.now]="tile.state === 'today'" [class.far]="tile.farOff">{{ tile.caption }}</span>
              </button>
            </li>
          }
        </ol>
        <div class="figures">
          <div class="figure">
            <strong>{{ figures().daysLogged }}</strong>
            <span>days logged</span>
          </div>
          <div class="figure">
            <strong>{{ figures().onTarget }}</strong>
            <span>on target</span>
          </div>
          <div class="figure">
            <strong>{{ kcalPerDay() }}</strong>
            <span>kcal a day</span>
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './diary-week.component.scss'
})
export class DiaryWeekComponent {
  readonly days = input<RangeDay[]>([]);
  /** The seven dates of the week, Monday first. */
  readonly dates = input.required<string[]>();
  readonly today = input.required<string>();
  readonly selected = input.required<string>();
  /** The calorie target, for a day whose entry carries none. */
  readonly target = input<number | null>(null);
  readonly failed = input(false);
  readonly pick = output<string>();
  readonly retry = output<void>();

  protected readonly tiles = computed(() => dayTiles(this.days(), this.dates(), this.today(), this.target()));
  protected readonly figures = computed(() => weekFigures(this.tiles()));
  protected readonly kcalPerDay = computed(() => {
    const average = this.figures().kcalPerDay;
    return average === null ? 'None yet' : whole(average);
  });
  protected readonly range = computed(() => {
    const dates = this.dates();
    return dates.length ? rangeLabel(dates[0], dates[dates.length - 1]) : '';
  });

  protected describe(tile: DayTile): string {
    const name = tile.state === 'today' ? 'today' : tile.weekday;
    return tile.logged ? `${name}, ${whole(tile.kcal)} kcal. Show this day.` : `${name}, nothing logged. Show this day.`;
  }
}
