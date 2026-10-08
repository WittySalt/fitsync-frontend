import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BadgeNode, FootprintDay } from '../../../core/me.models';
import { BadgeDiscComponent } from '../../../shared/badges/badge-disc.component';
import { doorFor, earnedLabel, evidenceLine, gapLine, paceSentence, weekCells } from '../../../shared/badges/badge-model';
import { WeekStripComponent } from '../../../shared/badges/week-strip.component';
import { WorkoutModalComponent } from '../../workout/workout-modal.component';

/**
 * The sheet a node opens. An earned node shows its evidence, the week it was earned in when it is a
 * week badge, and a door to where the evidence lives. The next node shows the gap and the pace.
 */
@Component({
  selector: 'app-badge-sheet',
  imports: [RouterLink, WorkoutModalComponent, BadgeDiscComponent, WeekStripComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './badge-sheet.component.html',
  styleUrl: './badge-sheet.component.scss'
})
export class BadgeSheetComponent {
  readonly node = input.required<BadgeNode>();
  readonly state = input.required<'earned' | 'next'>();
  /** The theme the node belongs to, which decides the door. */
  readonly theme = input('');
  readonly days = input<readonly FootprintDay[]>([]);
  readonly today = input('');
  readonly pace = input<number | null>(null);
  readonly closed = output<void>();

  protected readonly cells = computed(() => {
    const week = this.node().evidence?.weekStart;
    return week ? weekCells(week, this.days()) : [];
  });
  protected readonly evidence = computed(() => evidenceLine(this.node(), this.cells()));
  protected readonly earned = computed(() => earnedLabel(this.node()));
  protected readonly gap = computed(() => gapLine(this.node(), this.today(), this.pace()));
  protected readonly paceLine = computed(() => paceSentence(this.node(), this.today(), this.pace()));
  protected readonly door = computed(() => doorFor(this.theme() || this.node().theme, this.state()));
  protected readonly count = computed(() => {
    const { current, target, unit } = this.node().progress;
    // A unit such as a bodyweight ratio reads oddly after the numbers, so it is left out.
    return target > 0 ? `${Math.round(current * 100) / 100} of ${target}${unit && !/body|ratio/i.test(unit) ? ` ${unit}` : ''}` : '';
  });
}
