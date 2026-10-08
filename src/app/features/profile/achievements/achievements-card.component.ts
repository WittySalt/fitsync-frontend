import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SpotlightDirective } from '../../../core/guide/spotlight.directive';
import { BadgeNode, BadgesModel, FootprintDay } from '../../../core/me.models';
import { BadgeDiscComponent } from '../../../shared/badges/badge-disc.component';
import { earnedLabel, evidenceLine, nextUpLine, weekCells } from '../../../shared/badges/badge-model';
import { WeekStripComponent } from '../../../shared/badges/week-strip.component';

/** The Achievements card of the Me page: the latest badge with its evidence, the two closest, and the door to all of them. */
@Component({
  selector: 'app-achievements-card',
  imports: [RouterLink, BadgeDiscComponent, WeekStripComponent, SpotlightDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './achievements-card.component.html',
  styleUrl: './achievements-card.component.scss'
})
export class AchievementsCardComponent {
  readonly badges = input<BadgesModel | null>(null);
  readonly loading = input(false);
  readonly failed = input(false);
  /** The footprint days, for the week strip of a week badge; empty when the footprint did not load. */
  readonly days = input<readonly FootprintDay[]>([]);
  readonly today = input('');
  /** The person's sessions a week, for the estimate under a workout count. */
  readonly pace = input<number | null>(null);
  readonly retry = output<void>();

  protected readonly latest = computed(() => this.badges()?.latest ?? null);
  protected readonly cells = computed(() => {
    const week = this.latest()?.evidence?.weekStart;
    return week ? weekCells(week, this.days()) : [];
  });
  protected readonly latestLine = computed(() => {
    const latest = this.latest();
    return latest ? evidenceLine(latest, this.cells()) : '';
  });
  protected readonly nextUp = computed(() =>
    (this.badges()?.nextUp ?? []).map((node) => ({ node, line: nextUpLine(node, this.today(), this.pace()) }))
  );
  // 17 is the size of the badge catalogue, shown until the real total arrives.
  protected readonly allLabel = computed(() => `All ${this.badges()?.total ?? 17}`);

  protected earned(node: BadgeNode): string {
    return earnedLabel(node);
  }
}
