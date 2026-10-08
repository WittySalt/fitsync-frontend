import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { dailyObservations } from '../../dashboard/brief/brief-observations';
import { DAY_KIND_GLYPHS } from '../../dashboard/brief/day-kind-icons';
import { HEAT_KEY } from '../../../shared/charts/muscle-figure/muscle-figure';
import { ProgressCardContext } from '../../../shared/progress/progress.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { TrainingApiService } from '../training/training-api.service';
import { useLoad } from '../training/training-load';
import { FitFigureComponent, fittingHeight } from './fit-figure.component';
import { trainingCoachLine } from './card-lines';
import { ObserveHeightDirective, ObserveWidthDirective } from './observe-height.directive';
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
  imports: [FitFigureComponent, LogStripComponent, ObserveHeightDirective, ObserveWidthDirective, ProgressCardComponent, StatePanelComponent, SummaryListComponent],
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
  /** The hard-sets scale as a column: above 20 at the top, under 6 at the bottom. */
  protected readonly key = [...HEAT_KEY].reverse();
  protected readonly glyphs = DAY_KIND_GLYPHS;
  /** The kinds the strip's legend names: the three always, Mobility only when a day of it was logged. */
  protected readonly legend = computed(() => {
    const kinds = [
      { kind: 'STRENGTH' as const, name: 'Strength' },
      { kind: 'CARDIO' as const, name: 'Cardio' },
      { kind: 'SPORT' as const, name: 'Sport' }
    ];
    return this.data()?.calendar.some((day) => day.kind === 'MOBILITY') ? [...kinds, { kind: 'MOBILITY' as const, name: 'Mobility' }] : kinds;
  });
  /** The height of the strip, key and caption, which the figures match. */
  protected readonly leftHeight = signal(0);
  /** The width of the picture row, which decides side by side or stacked. */
  protected readonly rowWidth = signal(0);
  /** Two columns from 760 px, one column below, and nothing in between. */
  protected readonly stacked = computed(() => {
    const width = this.rowWidth();
    return width > 0 && width < 760;
  });
  /**
   * The tallest a view may be so that the figures, the gap and the scale never overflow the card.
   * Side by side, the figures get what is left after the 300 px strip column and the 48 px column gap.
   */
  protected readonly figureCap = computed(() => {
    const width = this.rowWidth();
    return width === 0 ? null : fittingHeight(this.stacked() ? width : width - 300 - 48);
  });

  protected retry(): void {
    this.read.retry();
  }
}
