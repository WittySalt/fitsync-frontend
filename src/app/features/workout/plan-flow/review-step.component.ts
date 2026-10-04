import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output } from '@angular/core';

import { PlanDayGlyphComponent } from '../plan-day-glyph.component';
import { DraftPlan, formatMinutes, PLAN_TYPE_LABELS, PlanType, WEEKDAY_SHORT } from './plan-draft';
import { currentPlanNote, reviewRow, WeekFigures } from './plan-summary';
import { observeBand } from './width-band';

/**
 * Step 2: the week laid out for a last look, four figures, the plan's name, type and description,
 * and the save. Wide, the week is one card of seven columns; medium and narrow it is a list with
 * one row per training day.
 */
@Component({
  selector: 'app-plan-review-step',
  imports: [PlanDayGlyphComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-step.component.html',
  styleUrl: './review-step.component.scss'
})
export class ReviewStepComponent {
  readonly plan = input.required<DraftPlan>();
  readonly figures = input.required<WeekFigures>();
  readonly makeCurrent = input(false);
  readonly currentPlanName = input<string | null>(null);
  readonly message = input<string | null>(null);
  readonly saveError = input<string | null>(null);
  readonly saving = input(false);
  readonly editing = input(false);

  readonly nameChange = output<string>();
  readonly typeChange = output<PlanType>();
  readonly descriptionChange = output<string>();
  readonly makeCurrentChange = output<boolean>();
  readonly back = output<void>();
  readonly save = output<void>();

  protected readonly band = observeBand(inject(ElementRef));
  protected readonly weekdays = WEEKDAY_SHORT;
  protected readonly types = Object.entries(PLAN_TYPE_LABELS) as Array<[PlanType, string]>;
  protected readonly rows = computed(() => this.plan().days.map((day) => (day.kind === 'REST' ? null : reviewRow(day))));
  protected readonly training = computed(() => this.rows().filter((row): row is NonNullable<typeof row> => row !== null));
  protected readonly note = computed(() => (this.makeCurrent() ? '' : currentPlanNote(this.currentPlanName())));
  protected readonly minutesLabel = computed(() => formatMinutes(this.figures().minutes));
}
