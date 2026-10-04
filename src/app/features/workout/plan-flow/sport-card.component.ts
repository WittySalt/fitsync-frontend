import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { SportActivityOption } from '../../../core/fitsync.models';
import { DraftDay, EffortLevel } from './plan-draft';
import { EffortChipsComponent } from './effort-chips.component';
import { HabitActivity } from './plan-week-proposal';

/** The nine sports the card offers when the catalogue lists none. */
export const FALLBACK_SPORTS: SportActivityOption[] = [
  { code: 'BADMINTON', label: 'Badminton', effort: 'MODERATE', measure: 'TIME' },
  { code: 'FOOTBALL', label: 'Football', effort: 'HARD', measure: 'TIME' },
  { code: 'BASKETBALL', label: 'Basketball', effort: 'HARD', measure: 'TIME' },
  { code: 'SWIMMING', label: 'Swimming', effort: 'MODERATE', measure: 'TIME' },
  { code: 'CYCLING', label: 'Cycling', effort: 'MODERATE', measure: 'TIME' },
  { code: 'TENNIS', label: 'Tennis', effort: 'MODERATE', measure: 'TIME' },
  { code: 'TABLE_TENNIS', label: 'Table tennis', effort: 'EASY', measure: 'TIME' },
  { code: 'RUNNING_CLUB', label: 'Running club', effort: 'MODERATE', measure: 'TIME' },
  { code: 'OTHER', label: 'Other', effort: 'MODERATE', measure: 'TIME' }
];

/** "Badminton on Saturdays, six weeks in a row", or the line for a sport not done before. */
export function sportHistoryLine(habit: HabitActivity | undefined): string {
  if (!habit) {
    return 'First time planned';
  }
  const days = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];
  const numbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const weeks = habit.streakWeeks <= 12 ? numbers[habit.streakWeeks] : String(habit.streakWeeks);
  return `${habit.label} on ${days[habit.dayOfWeek - 1]}, ${weeks} weeks in a row`;
}

/** The sport day's card: the activity as a grid of tiles, the effort expected and what history says. */
@Component({
  selector: 'app-plan-sport-card',
  imports: [EffortChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './sport-card.component.scss',
  template: `
    <section class="card">
      <div class="block">
        <span class="eyebrow">Activity</span>
        <div class="grid" role="group" aria-label="Sport">
          @for (sport of options(); track sport.code) {
            <button type="button" class="tile" [class.on]="day().sportActivity === sport.code" [attr.aria-pressed]="day().sportActivity === sport.code" (click)="choose(sport)">
              {{ sport.label }}
            </button>
          }
        </div>
      </div>
      <div class="block">
        <span class="eyebrow">Effort you expect</span>
        <app-plan-effort-chips [value]="day().effort" (choose)="patch.emit({ effort: $event })" />
      </div>
      <p class="line">{{ history() }}</p>
      <p class="line">Counts as a sport session; no moves to plan.</p>
    </section>
  `
})
export class SportCardComponent {
  readonly day = input.required<DraftDay>();
  readonly sports = input<SportActivityOption[]>([]);
  readonly habits = input<HabitActivity[]>([]);
  readonly patch = output<Partial<DraftDay>>();

  protected readonly options = computed(() => (this.sports().length ? this.sports() : FALLBACK_SPORTS));
  protected readonly history = computed(() =>
    sportHistoryLine(this.habits().find((habit) => habit.sportActivity === this.day().sportActivity))
  );

  protected choose(sport: SportActivityOption): void {
    const day = this.day();
    const labels = this.options().map((option) => option.label);
    const typed = day.title.trim() !== '' && !labels.includes(day.title.trim());
    const effort = (['EASY', 'MODERATE', 'HARD'] as EffortLevel[]).find((level) => level === sport.effort?.toUpperCase());
    this.patch.emit({
      sportActivity: sport.code,
      title: typed ? day.title : sport.label,
      effort: day.effort ?? effort ?? 'MODERATE'
    });
  }
}
