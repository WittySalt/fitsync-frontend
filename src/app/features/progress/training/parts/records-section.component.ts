import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { SectionCardComponent } from '../../../../shared/progress';
import { RecordEntry } from '../training.models';
import { grouped, kg, shortDate, signed } from '../training-format';

/** Records: new estimated best singles, newest first, each opening its exercise. */
@Component({
  selector: 'app-records-section',
  imports: [RouterLink, SectionCardComponent],
  template: `
    <app-section-card title="Records" sub="new estimated best singles, newest first" [context]="card()">
      @if (rows().length) {
        <ul>
          @for (row of rows(); track $index) {
            <li>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 4h8v5a4 4 0 0 1-8 0Z"></path><path d="M8 6H5a3 3 0 0 0 3 4"></path><path d="M16 6h3a3 3 0 0 1-3 4"></path><path d="M12 13v4"></path><path d="M8 20h8"></path>
              </svg>
              <span class="date">{{ row.date }}</span>
              @if (row.exerciseId) {
                <a class="name" [routerLink]="['/progress/training/exercises', row.exerciseId]">{{ row.name }}</a>
              } @else {
                <strong class="name">{{ row.name }}</strong>
              }
              <span class="value">{{ row.value }}</span>
              <span class="delta">{{ row.delta }}</span>
            </li>
          }
        </ul>
      } @else {
        <p class="empty">No new records in this period yet.</p>
      }
    </app-section-card>
  `,
  styleUrl: './records-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordsSectionComponent {
  readonly records = input<readonly RecordEntry[]>([]);
  readonly card = input<CoachCardContext | null>(null);

  protected readonly rows = computed(() =>
    this.records().map((record) => {
      const amount = record.unit === 'kg' ? `${kg(record.value)} kg` : `${grouped(record.value)} ${record.unit}`;
      const delta = record.delta === null ? '' : signed(record.delta, record.unit === 'kg' ? `${Math.abs(record.delta).toFixed(1)} kg` : `${grouped(Math.abs(record.delta))} ${record.unit}`);
      return {
        date: shortDate(record.date),
        name: record.name,
        exerciseId: record.exerciseId,
        value: record.unit === 'kg' ? `est. best single ${amount}` : amount,
        delta
      };
    })
  );
}
