import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ExerciseProgress } from '../training.models';
import { kg, shortDate } from '../training-format';

/** Every session of one exercise with its sets as logged and a PR mark on a record day; a date opens the session page. */
@Component({
  selector: 'app-exercise-history',
  imports: [RouterLink],
  template: `
    @if (rows().length) {
      <ul>
        @for (row of rows(); track row.sessionId || row.date) {
          <li>
            @if (row.sessionId) {
              <a class="date" [routerLink]="['/workout/sessions', row.sessionId]">{{ row.label }}</a>
            } @else {
              <span class="date">{{ row.label }}</span>
            }
            <span class="chips">
              @for (chip of row.chips; track $index) {
                <span class="chip">{{ chip }}</span>
              }
            </span>
            @if (row.record) {
              <span class="pr" aria-label="A personal record">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M8 4h8v5a4 4 0 0 1-8 0Z"></path><path d="M8 6H5a3 3 0 0 0 3 4"></path><path d="M16 6h3a3 3 0 0 1-3 4"></path><path d="M12 13v4"></path><path d="M8 20h8"></path>
                </svg>
                PR
              </span>
            } @else {
              <span></span>
            }
          </li>
        }
      </ul>
    } @else {
      <p class="quiet">No sets of this exercise in this period.</p>
    }
  `,
  styleUrl: './exercise-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseHistoryComponent {
  readonly history = input<ExerciseProgress['history']>([]);

  protected readonly rows = computed(() =>
    this.history().map((entry) => ({ ...entry, label: shortDate(entry.date), chips: entry.sets.map((set) => `${kg(set.weightKg)} kg × ${set.reps}`) }))
  );
}
