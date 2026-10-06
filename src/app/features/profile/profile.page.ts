import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { AccountDataService, AccountUserResponse } from '../../core/account-data.service';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { UserGoal } from '../../core/fitsync.models';
import { BadgesModel, Footprint } from '../../core/me.models';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { AboutData, AboutGoal } from './about/about-you';
import { AboutYouComponent } from './about/about-you.component';
import { AchievementsCardComponent } from './achievements/achievements-card.component';
import { IdentityCardComponent } from './identity/identity-card.component';
import { TargetsCardComponent } from './targets/targets-card.component';

interface SettingsRow {
  label: string;
  section: string;
  danger?: boolean;
}

const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER'];
const MEAL_NAMES: Record<string, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' };

/** The six settings rows; each opens the section of the settings page that holds it. */
export const SETTINGS_ROWS: readonly SettingsRow[] = [
  { label: 'Account', section: 'personal' },
  { label: 'Units', section: 'preferences' },
  { label: 'Nutrient reference ranges', section: 'preferences' },
  { label: 'Notifications', section: 'notifications' },
  { label: 'Data export', section: 'privacy-data' },
  { label: 'Delete account', section: 'privacy-data', danger: true }
];

/**
 * Me: what simply is. The identity card with the footprint, About you (the inputs the coach reads),
 * Targets, the latest and next badges, and the settings rows. Judgements live on Progress. The
 * footprint and the badges load apart from the person, so either failing leaves the rest of the page whole.
 */
@Component({
  selector: 'app-profile-page',
  imports: [RouterLink, StatePanelComponent, IdentityCardComponent, AboutYouComponent, TargetsCardComponent, AchievementsCardComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss'
})
export class ProfilePage implements OnInit {
  private readonly account = inject(AccountDataService);
  private readonly data = inject(FitSyncDataService);
  protected readonly today = inject(UserTimezoneService).dateKey();

  protected readonly settingsRows = SETTINGS_ROWS;

  protected readonly user = signal<AccountUserResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly goals = signal<UserGoal[]>([]);
  protected readonly usualMeals = signal<{ label: string; time: string }[]>([]);
  protected readonly usualStart = signal<string | null>(null);
  protected readonly injuries = signal<string[]>([]);

  protected readonly footprint = signal<Footprint | null>(null);
  protected readonly footprintLoading = signal(true);
  protected readonly footprintFailed = signal(false);

  protected readonly badges = signal<BadgesModel | null>(null);
  protected readonly badgesLoading = signal(true);
  protected readonly badgesFailed = signal(false);

  protected readonly about = computed<AboutData | null>(() => {
    const user = this.user();
    if (!user) {
      return null;
    }
    const training = user.preferences?.training;
    const weight = this.goals().find((goal) => goal.goalType === 'WEIGHT' && goal.targetValue !== null);
    const goal: AboutGoal | null = weight
      ? { type: weight.goalType, targetValue: weight.targetValue, targetUnit: weight.targetUnit, targetDate: weight.targetDate }
      : null;
    return {
      weeklyDays: training?.weeklyWorkoutDays ?? null,
      trainingTime: this.usualStart() ?? training?.preferredWorkoutTime?.slice(0, 5) ?? null,
      goal,
      weightKg: user.latestBodyMetrics?.weightKg ?? null,
      focusAreas: training?.focusAreas ?? [],
      equipment: training?.equipmentInventory ?? [],
      injuries: this.injuries(),
      diet: user.preferences?.nutrition?.dietaryPattern ?? null,
      meals: this.usualMeals()
    };
  });

  protected readonly pace = computed(() => this.user()?.preferences?.training?.weeklyWorkoutDays ?? null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.account.getCurrentUser().subscribe({
      next: (user) => {
        this.user.set(user);
        this.loading.set(false);
        this.loadAround();
        this.loadFootprint();
      },
      error: () => {
        this.error.set('Your profile could not be loaded. Nothing is lost. Try again in a moment.');
        this.loading.set(false);
      }
    });
    this.loadBadges();
  }

  /** The grid starts on the Monday of the week the account was created, so the join date is passed along. */
  protected loadFootprint(): void {
    this.footprintLoading.set(true);
    this.footprintFailed.set(false);
    const since = this.user()?.profile?.createdAt?.slice(0, 10) ?? null;
    this.data.getFootprint(since).subscribe({
      next: (footprint) => {
        this.footprint.set(footprint);
        this.footprintLoading.set(false);
      },
      error: () => {
        this.footprintFailed.set(true);
        this.footprintLoading.set(false);
      }
    });
  }

  protected loadBadges(): void {
    this.badgesLoading.set(true);
    this.badgesFailed.set(false);
    this.data.getBadges().subscribe({
      next: (badges) => {
        this.badges.set(badges);
        this.badgesLoading.set(false);
      },
      error: () => {
        this.badgesFailed.set(true);
        this.badgesLoading.set(false);
      }
    });
  }

  /** The targets, the usual meals and the usual training time. Each may be missing without harm. */
  protected loadAround(): void {
    this.loadGoals();
    forkJoin({
      meals: this.data.getUsualMeals().pipe(catchError(() => of([]))),
      insight: this.data.getWeeklyTrainingInsight().pipe(catchError(() => of(null))),
      injuries: this.data.getInjuryAreas()
    }).subscribe(({ meals, insight, injuries }) => {
      this.injuries.set(injuries);
      this.usualMeals.set(
        MEAL_ORDER.map((type) => meals.find((meal) => meal.mealType === type))
          .filter((meal): meal is NonNullable<typeof meal> => !!meal && meal.usualTime !== null)
          .map((meal) => ({ label: MEAL_NAMES[meal.mealType] ?? meal.label, time: meal.usualTime as string }))
      );
      this.usualStart.set(insight?.usualStartTime ?? null);
    });
  }

  protected loadGoals(): void {
    this.data.getGoals().subscribe((goals) => this.goals.set(goals));
  }
}
