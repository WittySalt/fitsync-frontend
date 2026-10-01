import { Component, computed, input } from '@angular/core';

import { DayKind, WorkoutSession } from '../../core/fitsync.models';
import { formatKm } from '../dashboard/brief/brief-duration';
import { PlanDayGlyphComponent } from './plan-day-glyph.component';
import { sessionDurationLabel } from './workout-session.util';

const KINDS: readonly DayKind[] = ['STRENGTH', 'CARDIO', 'MOBILITY', 'SPORT'];

/**
 * The inside of one History row: the kind of the workout, its name and day, two facts (how long,
 * and how many sets or how far), its state and the arrow that says it opens a page. The row
 * itself is the host's button, so the whole row is one target.
 */
@Component({
  selector: 'app-history-row',
  imports: [PlanDayGlyphComponent],
  template: `
    <span class="kind" aria-hidden="true"><app-plan-day-glyph [kind]="kind()" [size]="18" /></span>
    <span class="what">
      <strong class="name">{{ session().name }}</strong>
      <span class="when">{{ when() }}</span>
    </span>
    <span class="facts">{{ facts() }}</span>
    <span class="state" [class.done]="session().status === 'COMPLETED'">{{ state() }}</span>
    <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"></path></svg>
  `,
  styleUrl: './history-row.component.scss'
})
export class HistoryRowComponent {
  readonly session = input.required<WorkoutSession>();

  protected readonly kind = computed<DayKind>(() => {
    const kind = (this.session().kind ?? '').toUpperCase() as DayKind;
    return KINDS.includes(kind) ? kind : 'STRENGTH';
  });

  /** "Wed 1 Oct · 21:13". */
  protected readonly when = computed(() => {
    const start = new Date(this.session().startedAt);
    if (Number.isNaN(start.getTime())) {
      return '';
    }
    const day = start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} · ${time}`;
  });

  /** "48 min · 9 of 12 sets", or the distance for a run. */
  protected readonly facts = computed(() => {
    const session = this.session();
    const parts = [sessionDurationLabel(session)];
    if (session.distanceKm != null && session.distanceKm > 0) {
      parts.push(formatKm(session.distanceKm));
    } else if (session.totalSets) {
      parts.push(`${session.doneSets ?? 0} of ${session.totalSets} sets`);
    }
    return parts.filter((part) => part && part !== '—' && part !== '-').join(' · ') || '—';
  });

  protected readonly state = computed(() => {
    switch (this.session().status) {
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'IN_PROGRESS':
        return 'In progress';
      default:
        return 'Planned';
    }
  });
}
