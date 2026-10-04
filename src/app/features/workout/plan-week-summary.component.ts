import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { PlanDayKind, WorkoutPlanDay } from '../../core/fitsync.models';
import { PlanDayGlyphComponent } from './plan-day-glyph.component';
import { WEEKDAY_NAMES } from './plan-flow/plan-draft';

interface SummaryTile {
  kind: PlanDayKind | null;
  label: string;
}

/** A plan's week in one line: seven small tiles, Monday first, with the glyph of each training
 *  day and an empty tile for each rest day, then the number of sessions. */
@Component({
  selector: 'app-plan-week-summary',
  imports: [PlanDayGlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      min-width: 0;
    }

    .tiles {
      display: flex;
      gap: 4px;
    }

    .tile {
      box-sizing: border-box;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      background: var(--surface-sunken);
      color: var(--text-muted);
    }

    .tile.training {
      border: 1px solid var(--accent);
      background: var(--surface-tint);
      color: var(--accent-text);
    }

    .count {
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: var(--fw-bold);
    }
  `,
  template: `
    <span class="tiles" role="img" [attr.aria-label]="description()">
      @for (tile of tiles(); track $index) {
        <span class="tile" [class.training]="tile.kind !== null">
          @if (tile.kind; as kind) {
            <app-plan-day-glyph [kind]="kind" [size]="14" />
          }
        </span>
      }
    </span>
    <span class="count">{{ sessions() }} {{ sessions() === 1 ? 'session' : 'sessions' }} a week</span>
  `
})
export class PlanWeekSummaryComponent {
  readonly days = input.required<readonly WorkoutPlanDay[]>();
  readonly sessions = input.required<number>();

  protected readonly tiles = computed<SummaryTile[]>(() =>
    WEEKDAY_NAMES.map((name, index) => {
      const day = this.days().find((entry) => entry.dayOfWeek === index + 1);
      return { kind: day?.kind ?? null, label: day ? `${name}, ${day.title}` : `${name}, rest` };
    })
  );

  protected readonly description = computed(() => this.tiles().map((tile) => tile.label).join('. '));
}
