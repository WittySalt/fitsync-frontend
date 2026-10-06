import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AccountDataService, AccountUserResponse } from '../../core/account-data.service';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { UserGoal, WeeklyTrainingInsight } from '../../core/fitsync.models';
import { BADGES, FOOTPRINT } from '../../core/me-fixtures.spec';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { ProfilePage, SETTINGS_ROWS } from './profile.page';

function user(overrides: Partial<AccountUserResponse> = {}): AccountUserResponse {
  return {
    userId: 'u1',
    email: 'steady@example.test',
    role: 'USER',
    profile: {
      displayName: 'Ruixian',
      firstName: 'Ruixian',
      lastName: null,
      avatarUrl: null,
      birthDate: '1996-01-01',
      gender: 'MALE',
      heightCm: 171,
      activityLevel: 'MODERATELY_ACTIVE',
      timezone: 'Asia/Singapore',
      locationDisplay: 'Singapore',
      bio: null,
      membershipTier: null,
      membershipStatus: null,
      onboardingCompleted: true
    },
    preferences: {
      app: { preferredUnits: 'METRIC', language: 'en', timezone: null, privacyLevel: 'PRIVATE', dataSharingConsent: false },
      training: {
        fitnessLevel: 'INTERMEDIATE',
        trainingLocation: 'GYM',
        weeklyWorkoutDays: 4,
        preferredDurationMinutes: 45,
        preferredWorkoutTime: '19:00:00',
        intensityPreference: 'MODERATE',
        focusAreas: ['SHOULDERS', 'ARMS', 'GLUTES'],
        equipmentInventory: ['DUMBBELLS']
      },
      nutrition: { dietaryPattern: '300001', mealFrequency: 4, calorieTrackingMode: 'AUTO', macroPreference: 'BALANCED', waterGoalMl: 2500 },
      notifications: {} as AccountUserResponse['preferences']['notifications']
    },
    activeGoals: [],
    latestBodyMetrics: { weightKg: 71.2 } as AccountUserResponse['latestBodyMetrics'],
    ...overrides
  };
}

const goals: UserGoal[] = [
  { goalId: 'g1', goalType: 'WEIGHT', targetValue: 68, targetUnit: 'kg', targetDate: '2026-12-11', status: 'ACTIVE', notes: null },
  { goalId: 'g2', goalType: 'CALORIES', targetValue: 2100, targetUnit: 'kcal', targetDate: null, status: 'ACTIVE', notes: null }
];

describe('ProfilePage', () => {
  let account: jasmine.SpyObj<AccountDataService>;
  let data: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-06T04:00:00Z'));
    account = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['getCurrentUser']);
    account.getCurrentUser.and.returnValue(of(user()));
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getFootprint', 'getBadges', 'getGoals', 'getUsualMeals', 'getWeeklyTrainingInsight', 'getInjuryAreas']);
    data.getInjuryAreas.and.returnValue(of(['LOWER_BACK']));
    data.getFootprint.and.returnValue(of(FOOTPRINT));
    data.getBadges.and.returnValue(of(BADGES));
    data.getGoals.and.returnValue(of(goals));
    data.getUsualMeals.and.returnValue(
      of([
        { mealType: 'BREAKFAST', label: 'Breakfast', usualTime: '07:30', sourceMealId: null, totalCalories: null, totalProteinGrams: null, totalCarbsGrams: null, totalFatGrams: null, items: [] },
        { mealType: 'DINNER', label: 'Dinner', usualTime: '19:00', sourceMealId: null, totalCalories: null, totalProteinGrams: null, totalCarbsGrams: null, totalFatGrams: null, items: [] }
      ])
    );
    data.getWeeklyTrainingInsight.and.returnValue(of({ usualStartTime: '19:00' } as unknown as WeeklyTrainingInsight));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AccountDataService, useValue: account }, { provide: FitSyncDataService, useValue: data }]
    });
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
  });

  afterEach(() => jasmine.clock().uninstall());

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const clean = (element: Element | null | undefined) => ((element as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim();

  it('stacks the identity card, About you, Targets, Achievements and Settings in that order', () => {
    const el = render();

    const order = Array.from(el.querySelector('.me')!.children).map((child) => child.tagName.toLowerCase() + (child.classList.contains('settings') ? '.settings' : ''));
    expect(order).toEqual(['app-identity-card', 'app-about-you', 'app-targets-card', 'app-achievements-card', 'section.settings']);
  });

  it('shows the identity card with the member line and the lifetime numbers', () => {
    const el = render();

    expect(el.querySelector('h1')?.textContent).toBe('Ruixian');
    expect(el.querySelector('.member')?.textContent).toBe('Member since 4 Aug 2026 · Singapore');
    expect(Array.from(el.querySelectorAll('.totals dl > div')).map((entry) => clean(entry))).toEqual(['31 WORKOUTS', '58 DAYS LOGGED', '7 BADGES']);
    expect(el.querySelector('.log')?.getAttribute('href')).toBe('/progress/training#log');
    expect(el.querySelector('.edit')?.getAttribute('href')).toBe('/settings?section=personal');
  });

  it('writes About you from the inputs, the usual meals and the usual start time', () => {
    const el = render();

    expect(el.querySelector('.lead')?.textContent).toBe('Four evenings a week, lose weight to 68 kg by 11 Dec.');
    expect(el.querySelectorAll('app-day-line .dot').length).toBe(2);
    expect(el.querySelector('app-day-line .training')).toBeTruthy();
  });

  it('shows the targets and the achievements with the gap in the unit of each badge', () => {
    const el = render();

    expect(el.querySelectorAll('app-targets-card .row').length).toBe(2);
    expect(clean(el.querySelector('app-achievements-card .latest'))).toContain('A full week');
    expect(clean(el.querySelector('app-achievements-card .latest'))).toContain('4 sessions in the week of 21 Sept');
    expect(Array.from(el.querySelectorAll('app-achievements-card .next-up li')).map((entry) => clean(entry))).toEqual([
      '50 workouts 19 to go · about 5 weeks at your pace',
      'Seven days logged 2 to go · log tomorrow and Thursday'
    ]);
    expect(clean(el.querySelector('app-achievements-card .open'))).toBe('All 17 ›');
    expect(el.querySelector('app-achievements-card .open')?.getAttribute('href')).toBe('/me/achievements');
  });

  it('shows the injuries from the health readiness answers', () => {
    const chips = Array.from(render().querySelectorAll('app-about-you .chip')).map((chip) => clean(chip));

    expect(chips).toContain('Lower back');
    expect(data.getInjuryAreas).toHaveBeenCalled();
  });

  it('names focus areas that arrive as codes and never shows a code', () => {
    const base = user();
    account.getCurrentUser.and.returnValue(of(user({ preferences: { ...base.preferences, training: { ...base.preferences.training, focusAreas: ['240002', '240003'] } } })));

    const el = render();

    expect(el.querySelector('app-about-you .caption')?.textContent).toBe('Focus: upper body, core');
    expect(el.textContent).not.toMatch(/2400\d\d/);
  });

  it('writes the lead sentence from the sessions target, not the preference', () => {
    data.getGoals.and.returnValue(of([...goals, { goalId: 'g3', goalType: 'WORKOUT_FREQUENCY', targetValue: 3, targetUnit: 'sessions/week', targetDate: null, status: 'ACTIVE', notes: null }]));

    expect(render().querySelector('app-about-you .lead')?.textContent).toBe('Three evenings a week, lose weight to 68 kg by 11 Dec.');
  });

  it('has six settings rows, each to its section, with Delete account in the danger colour', () => {
    const el = render();

    const rows = Array.from(el.querySelectorAll<HTMLAnchorElement>('.settings a'));
    expect(rows.map((row) => clean(row))).toEqual(SETTINGS_ROWS.map((row) => row.label));
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/settings?section=personal',
      '/settings?section=preferences',
      '/settings?section=preferences',
      '/settings?section=notifications',
      '/settings?section=privacy-data',
      '/settings?section=privacy-data'
    ]);
    expect(rows.filter((row) => row.classList.contains('danger')).map((row) => clean(row))).toEqual(['Delete account']);
  });

  it('removes the old blocks', () => {
    const text = clean(render());

    for (const gone of ['Lifetime stats', 'Streak', 'Active target', 'Latest entries', 'Manage targets']) {
      expect(text).not.toContain(gone);
    }
    expect(render().querySelector('app-goal-lifecycle')).toBeNull();
  });

  it('keeps the identity card and About you when the footprint fails, with the error inside the card only', () => {
    data.getFootprint.and.returnValue(throwError(() => new Error('down')));

    const el = render();

    expect(clean(el.querySelector('app-identity-card .failed'))).toBe('Your footprint could not be loaded. Try again');
    expect(el.querySelector('h1')?.textContent).toBe('Ruixian');
    expect(el.querySelector('app-about-you .lead')).toBeTruthy();
    expect(el.querySelector('app-targets-card')).toBeTruthy();
    expect(el.querySelector('app-achievements-card .latest')).toBeTruthy();
  });

  it('keeps the identity card and About you when the achievements fail, with the error inside that card only', () => {
    data.getBadges.and.returnValue(throwError(() => new Error('down')));

    const el = render();

    expect(clean(el.querySelector('app-achievements-card .failed'))).toBe('Your achievements could not be loaded. Try again');
    expect(el.querySelector('app-identity-card .totals')).toBeTruthy();
    expect(el.querySelector('app-about-you .lead')).toBeTruthy();
    expect(el.querySelector('app-identity-card .failed')).toBeNull();
  });

  it('retries only the footprint from its own Try again', () => {
    data.getFootprint.and.returnValue(throwError(() => new Error('down')));
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();

    data.getFootprint.and.returnValue(of(FOOTPRINT));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('app-identity-card .retry')!.click();
    fixture.detectChanges();

    expect(data.getFootprint).toHaveBeenCalledTimes(2);
    expect(data.getBadges).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-identity-card .totals')).toBeTruthy();
  });

  it('shows the empty account with its empty states', () => {
    account.getCurrentUser.and.returnValue(
      of(
        user({
          preferences: { ...user().preferences, training: { ...user().preferences.training, weeklyWorkoutDays: null, preferredWorkoutTime: null, focusAreas: [], equipmentInventory: [] }, nutrition: { ...user().preferences.nutrition, dietaryPattern: '' } },
          latestBodyMetrics: null
        })
      )
    );
    data.getFootprint.and.returnValue(of({ ...FOOTPRINT, days: [], totals: { workouts: 0, daysLogged: 0, badges: 0 }, memberSince: '2026-10-06', from: '2026-10-05' }));
    data.getBadges.and.returnValue(of({ ...BADGES, earned: 0, latest: null, nextUp: [BADGES.themes[0].paths[0].nodes[0], BADGES.themes[2].paths[0].nodes[0]].map((entry) => ({ ...entry, earnedOn: null, progress: { ...entry.progress, current: 0 } })) }));
    data.getGoals.and.returnValue(of([]));
    data.getUsualMeals.and.returnValue(of([]));
    data.getInjuryAreas.and.returnValue(of([]));
    data.getWeeklyTrainingInsight.and.returnValue(of({ usualStartTime: null } as unknown as WeeklyTrainingInsight));

    const el = render();

    expect(clean(el.querySelector('.starts'))).toBe('Your footprint starts with your first workout or meal.');
    expect(Array.from(el.querySelectorAll('.totals dl > div')).map((entry) => clean(entry))).toEqual(['0 WORKOUTS', '0 DAYS LOGGED', '0 BADGES']);
    expect(el.querySelector('app-about-you .lead')?.textContent).toBe('Nothing set yet.');
    expect(el.querySelectorAll('app-about-you .chip.add').length).toBe(3);
    expect(clean(el.querySelector('app-targets-card .none'))).toBe('No targets yet');
    expect(clean(el.querySelector('app-targets-card .set'))).toBe('Set a target');
    expect(el.querySelector('app-achievements-card .latest')).toBeNull();
    expect(Array.from(el.querySelectorAll('app-achievements-card .next-up li')).map((entry) => clean(entry))).toEqual([
      'First workout First workout (how)',
      'First meal logged First meal logged (how)'
    ]);
  });

  it('shows a panel with Try again when the profile cannot be loaded, and reloads from it', () => {
    account.getCurrentUser.and.returnValue(throwError(() => new Error('down')));
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('app-state-panel')).toBeTruthy();
    expect(el.querySelector('app-identity-card')).toBeNull();

    account.getCurrentUser.and.returnValue(of(user()));
    el.querySelector<HTMLButtonElement>('app-state-panel button')!.click();
    fixture.detectChanges();

    expect(el.querySelector('app-identity-card')).toBeTruthy();
  });
});
