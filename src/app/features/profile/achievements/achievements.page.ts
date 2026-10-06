import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AccountDataService } from '../../../core/account-data.service';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { BadgesModel, FootprintDay } from '../../../core/me.models';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { earnedLabel } from '../../../shared/badges/badge-model';
import { shortDate } from '../../../shared/coach/insight/slope-chart.geometry';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { BadgeSheetComponent } from './badge-sheet.component';
import { OpenedNode, ThemeCardComponent } from './theme-card.component';

export const FOOTNOTE = 'Badges count what you logged. Nothing is lost when a week is missed.';

/** "7 of 17 earned · since 4 Aug": the head line of the page. */
export function headLine(earned: number, total: number, since: string): string {
  const base = `${earned} of ${total} earned`;
  const date = since ? shortDate(since) : '';
  return date ? `${base} · since ${date}` : base;
}

/**
 * Achievements: four theme cards with their paths, the sheet of the node that was tapped, and a
 * quiet row for badges that are no longer in the catalogue but were earned.
 */
@Component({
  selector: 'app-achievements-page',
  imports: [RouterLink, StatePanelComponent, ThemeCardComponent, BadgeSheetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './achievements.page.html',
  styleUrl: './achievements.page.scss'
})
export class AchievementsPage implements OnInit {
  private readonly data = inject(FitSyncDataService);
  private readonly account = inject(AccountDataService);
  protected readonly today = inject(UserTimezoneService).dateKey();

  protected readonly badges = signal<BadgesModel | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly days = signal<readonly FootprintDay[]>([]);
  protected readonly pace = signal<number | null>(null);
  protected readonly opened = signal<OpenedNode | null>(null);
  protected readonly footnote = FOOTNOTE;

  protected readonly head = computed(() => {
    const badges = this.badges();
    return badges ? headLine(badges.earned, badges.total, badges.since) : '';
  });

  protected readonly earlier = computed(() =>
    (this.badges()?.earlier ?? []).map((node) => ({ code: node.code, name: node.name, date: earnedLabel(node) }))
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.data.getBadges().subscribe({
      next: (badges) => {
        this.badges.set(badges);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      }
    });
    // The week strip and the pace are extras: without them the sheets still open.
    this.data
      .getFootprint()
      .pipe(catchError(() => of(null)))
      .subscribe((footprint) => this.days.set(footprint?.days ?? []));
    this.account
      .getCurrentUser()
      .pipe(catchError(() => of(null)))
      .subscribe((user) => this.pace.set(user?.preferences?.training?.weeklyWorkoutDays ?? null));
  }
}
