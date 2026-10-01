import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';

import { ToastService } from '../../../../core/toast/toast.service';

import { MonthDayComponent } from './month-day.component';
import { MonthFiguresComponent } from './month-figures.component';
import { buildFigures, emptyMonthLine, headLine, headTitle } from './month-figures';
import { MONTH_IMAGE_EXPORT } from './month-image-export';
import { buildMonthImageModel, monthImageFileName } from './month-image';
import { MonthMuscleComponent } from './month-muscle.component';
import { muscleChartTitle } from './month-muscle';
import { MonthNoticedComponent } from './month-noticed.component';
import { buildMonthObservations } from './month-observations';
import { MonthRadarComponent } from './month-radar.component';
import { MonthViewState } from './month-view.state';
import { MonthWeekBarsComponent } from './month-week-bars.component';

/** The body of the dark panel in the month view: the month, six figures, the two charts and what
 *  the coach noticed. While the month loads it shows blocks in the shape of these parts, and when
 *  the month cannot be loaded it keeps the title only, since the calendar offers the retry. */
@Component({
  selector: 'app-month-panel',
  standalone: true,
  imports: [MonthDayComponent, MonthFiguresComponent, MonthMuscleComponent, MonthNoticedComponent, MonthRadarComponent, MonthWeekBarsComponent],
  templateUrl: './month-panel.component.html',
  styleUrl: './month-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthPanelComponent {
  protected readonly state = inject(MonthViewState);
  private readonly radar = viewChild(MonthRadarComponent);
  private readonly imageExport = inject(MONTH_IMAGE_EXPORT);
  private readonly toast = inject(ToastService);

  /** The sessions a week should reach, from the brief's weekly goal. */
  readonly weeklyTarget = input<number | null>(null);
  /** The name that goes on the saved picture. */
  readonly personName = input('');

  protected readonly selectedDate = computed(() => this.state.selectedDate());
  protected readonly selectedMuscle = computed(() => this.state.selectedMuscle());
  protected readonly status = computed(() => this.state.status());
  protected readonly insight = computed(() => this.state.insight());
  protected readonly title = computed(() => headTitle(this.state.month(), this.state.referenceDate()));
  protected readonly figures = computed(() => {
    const insight = this.insight();
    return insight && this.hasTraining()
      ? buildFigures({
          insight,
          weeklyTarget: this.weeklyTarget(),
          badgeDates: this.state.badgeDates(),
          badgeState: this.state.badgeStatus()
        })
      : [];
  });

  protected readonly since = computed(() => {
    const insight = this.insight();
    const hasArrows = this.figures().some((figure) => figure.compare !== null);
    return insight ? headLine(insight.month, insight.firstSessionDate, hasArrows) : null;
  });

  /** The title of the radar: the picked group and its sessions while one is picked. */
  protected readonly muscleTitle = computed(() => {
    const picked = this.selectedMuscle();
    const muscle = picked ? this.insight()?.muscles.find((entry) => entry.group === picked) : null;
    return muscle ? muscleChartTitle(muscle) : 'By muscle group';
  });

  /** A month without a session has figures of zero and nothing to draw or to say. */
  protected readonly hasTraining = computed(() => (this.insight()?.totals.sessions ?? 0) > 0);
  /** The one calm line of a month without a session, in place of the figures and the charts. */
  protected readonly emptyLine = computed(() => {
    const insight = this.insight();
    return insight && !this.hasTraining() ? emptyMonthLine(insight.month, this.state.referenceDate()) : null;
  });
  protected readonly observations = computed(() => {
    const insight = this.insight();
    return insight && this.hasTraining()
      ? buildMonthObservations({ insight, weeklyTarget: this.weeklyTarget(), weights: this.state.weights() })
      : [];
  });

  /** True while the picture is being made, so the button cannot be pressed twice. */
  protected readonly saving = signal(false);
  /** The button is offered once the month has loaded and holds a session. */
  protected readonly canSave = computed(() => this.status() === 'ready' && this.hasTraining());

  protected async saveImage(): Promise<void> {
    const insight = this.insight();
    if (this.saving() || !insight || !this.canSave()) {
      return;
    }
    this.saving.set(true);
    try {
      const model = buildMonthImageModel({
        insight,
        figures: this.figures(),
        observations: this.observations(),
        personName: this.personName()
      });
      const blob = await this.imageExport.make(model);
      this.imageExport.save(blob, monthImageFileName(insight.month));
      this.toast.success('Saved to your device.');
    } catch {
      this.toast.error('The picture could not be made.');
    } finally {
      this.saving.set(false);
    }
  }

  constructor() {
    // The button that lets go of a muscle group goes away with the lower part, so the focus
    // returns to the label that was picked.
    effect(() => {
      const target = this.state.focusTarget();
      if (target?.kind === 'muscle') {
        untracked(() => {
          this.radar()?.focusGroup(target.key);
          this.state.focusTarget.set(null);
        });
      }
    });
  }
}
