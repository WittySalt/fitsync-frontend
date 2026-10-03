import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CoachCardContext } from '../../../core/coach/coach.models';
import { SmallTrendComponent, SummaryLinesComponent } from '../../../shared/progress';
import { activityLine, daysTrainedLine, liftRow, radarFigures, recordsLine } from './card/training-card';
import { TrainingRadarComponent } from './card/training-radar.component';
import { AskChipComponent } from './parts/ask-chip.component';
import { KindTileComponent } from './parts/kind-tile.component';
import { TrainingCalendarComponent } from './parts/training-calendar.component';
import { TrainingApiService } from './training-api.service';
import { useLoad } from './training-load';
import { LiftRow } from './card/training-card';

/**
 * The Training card on Progress (board 18c): the period's calendar and the radar, the main lifts
 * with their est. best single from start to now, the other activities in three lines, and the
 * records. The whole card opens the Training page; Ask opens the coach about it.
 */
@Component({
  selector: 'app-training-card',
  imports: [AskChipComponent, KindTileComponent, RouterLink, SmallTrendComponent, SummaryLinesComponent, TrainingCalendarComponent, TrainingRadarComponent],
  templateUrl: './card/training-card.component.html',
  styleUrl: './card/training-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainingCardComponent {
  private readonly api = inject(TrainingApiService);
  private readonly router = inject(Router);

  /** The Progress page's period, inclusive ISO days. */
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  /** The number of the coach's fact that cites this card, when the reading has one. */
  readonly citation = input<number | null>(null);
  /** How the records line names the period: "these 4 weeks". */
  readonly periodWords = input('these 4 weeks');

  private readonly range = computed(() => ({ from: this.from(), to: this.to() }));
  private readonly read = useLoad(this.range, (range) => this.api.getTraining(range.from, range.to), 'Training could not load.');
  protected readonly state = this.read.state;

  protected readonly data = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly card = computed<CoachCardContext>(() => ({ kind: 'TRAINING', from: this.from(), to: this.to() }));
  protected readonly lifts = computed(() => (this.data()?.lifts ?? []).map(liftRow).filter((row): row is LiftRow => row !== null));
  protected readonly others = computed(() => (this.data()?.activities ?? []).filter((activity) => activity.kind !== 'STRENGTH').slice(0, 2));
  protected readonly strength = computed(() => this.data()?.activities.find((activity) => activity.kind === 'STRENGTH') ?? null);
  protected readonly radar = computed(() => (this.data() ? radarFigures(this.data()!.muscles) : null));
  protected readonly daysLine = computed(() => (this.data() ? daysTrainedLine(this.data()!) : ''));
  protected readonly records = computed(() => recordsLine(this.data()?.records ?? [], this.periodWords()));
  protected readonly empty = computed(() => {
    const data = this.data();
    return data !== null && !data.calendar.length && !data.activities.length;
  });
  protected readonly line = activityLine;

  protected open(event: Event): void {
    if ((event.target as HTMLElement | null)?.closest('a, button')) {
      return;
    }
    void this.router.navigate(['/progress/training']);
  }

  protected retry(): void {
    this.read.retry();
  }
}
