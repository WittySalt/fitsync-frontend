import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { dailyObservations } from '../../dashboard/brief/brief-observations';

import { HEAT_KEY } from '../../../shared/charts/muscle-figure/muscle-figure';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { TrainingApiService } from '../training/training-api.service';
import { useLoad } from '../training/training-load';
import { FitFigureComponent } from './fit-figure.component';
import { trainingCoachLine } from './card-lines';
import { LogStripComponent } from './log-strip.component';
import { ProgressCardComponent } from './progress-card.component';
import { SummaryListComponent } from './summary-list.component';
import { activityRows, trainingHeadline } from './training-figures';

/**
 * The Training card (board 21a): days trained as the headline, one block per activity, the 28-day
 * log and the muscle figure. The figure is a picture here; the card is the link.
 */
@Component({
  selector: 'app-training-card',
  imports: [FitFigureComponent, LogStripComponent, ProgressCardComponent, StatePanelComponent, SummaryListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './training-card.component.html',
  styleUrl: './training-card.component.scss'
})
export class TrainingCardComponent {
  private readonly api = inject(TrainingApiService);
  private readonly timezone = inject(UserTimezoneService);
  /** The weekly insight the Home brief reads; without it the card simply has no coach line. */
  private readonly insight = toSignal(inject(FitSyncDataService).getWeeklyTrainingInsight().pipe(catchError(() => of(null))), { initialValue: null });

  readonly from = input.required<string>();
  readonly to = input.required<string>();
  /** How the headline names the period: "these 4 weeks". */
  readonly periodWords = input('these 4 weeks');

  private readonly range = computed(() => ({ from: this.from(), to: this.to() }));
  private readonly read = useLoad(this.range, (range) => this.api.getTraining(range.from, range.to), 'Training could not load.');
  protected readonly state = this.read.state;

  protected readonly context = computed<ProgressCardContext>(() => ({ kind: 'TRAINING', from: this.from(), to: this.to() }));
  protected readonly data = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly coachLine = computed(() => {
    const insight = this.insight();
    return insight ? trainingCoachLine(dailyObservations(insight, new Date(), this.timezone.zone())) : '';
  });
  protected readonly empty = computed(() => {
    const data = this.data();
    return data !== null && !data.calendar.length && !data.activities.length;
  });
  protected readonly headline = computed(() => {
    const data = this.data();
    return data ? trainingHeadline(data, this.periodWords()) : null;
  });
  protected readonly rows = computed(() => {
    const data = this.data();
    return data ? activityRows(data) : [];
  });
  protected readonly sets = computed<Record<string, number>>(() => Object.fromEntries((this.data()?.muscles.groups ?? []).map((group) => [group.group, group.setsPerWeek])));
  protected readonly hasMuscles = computed(() => Object.values(this.sets()).some((value) => value > 0));
  protected readonly key = HEAT_KEY;

  protected retry(): void {
    this.read.retry();
  }
}
