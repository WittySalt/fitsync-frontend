import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AccountDataService, AccountUserResponse } from '../../../core/account-data.service';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { anchorSteps } from '../../../core/guide/guide-testing.spec';
import { BADGES, FOOTPRINT, node } from '../../../core/me-fixtures.spec';
import { BadgesModel } from '../../../core/me.models';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { AchievementsPage, FOOTNOTE, headLine } from './achievements.page';

describe('AchievementsPage', () => {
  let data: jasmine.SpyObj<FitSyncDataService>;
  let account: jasmine.SpyObj<AccountDataService>;
  let fixture: ComponentFixture<AchievementsPage>;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-06T04:00:00Z'));
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getBadges', 'getFootprint']);
    data.getBadges.and.returnValue(of(BADGES));
    data.getFootprint.and.returnValue(of(FOOTPRINT));
    account = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['getCurrentUser']);
    account.getCurrentUser.and.returnValue(of({ preferences: { training: { weeklyWorkoutDays: 4 } } } as unknown as AccountUserResponse));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: FitSyncDataService, useValue: data }, { provide: AccountDataService, useValue: account }]
    });
    TestBed.inject(UserTimezoneService).setProfileZone('Asia/Singapore');
  });

  afterEach(() => jasmine.clock().uninstall());

  const root = () => fixture.nativeElement as HTMLElement;
  const clean = (element: Element | null | undefined) => ((element as HTMLElement | null)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  function render(model: BadgesModel = BADGES): void {
    data.getBadges.and.returnValue(of(model));
    fixture = TestBed.createComponent(AchievementsPage);
    fixture.detectChanges();
  }

  it('writes the head line', () => {
    expect(headLine(7, 17, '2026-08-04')).toBe('7 of 17 earned · since 4 Aug');
    expect(headLine(0, 17, '')).toBe('0 of 17 earned');
    render();
    expect(clean(root().querySelector('.sub'))).toBe('7 of 17 earned · since 4 Aug');
    expect(root().querySelector('h1')?.textContent).toBe('Achievements');
  });

  it('anchors every path and every badge that can be opened', () => {
    render();
    const steps = anchorSteps(root(), 'me-achievements');
    expect(steps.filter((step) => step === 'path').length).toBe(6);
    expect(steps).toContain('badge');
  });

  it('draws four theme cards with their counts', () => {
    render();

    expect(Array.from(root().querySelectorAll('app-theme-card h2')).map((entry) => entry.textContent)).toEqual(['Showing up', 'Getting stronger', 'Eating well', 'In the kitchen']);
    expect(Array.from(root().querySelectorAll('app-theme-card .count')).map((entry) => entry.textContent)).toEqual(['3 of 6', '1 of 3', '2 of 5', '1 of 3']);
    expect(root().querySelectorAll('app-theme-card .path').length).toBe(6);
  });

  it('shows earned with its date, next with the gap in bold, and later in the soft colour', () => {
    render();
    const nodes = Array.from(root().querySelectorAll<HTMLElement>('app-theme-card li')).map((entry) => [entry.dataset['state'], clean(entry)]);

    expect(nodes.slice(0, 4)).toEqual([
      ['earned', 'First workout 7 Aug'],
      ['earned', '10 workouts 24 Aug'],
      ['next', '50 workouts 19 to go'],
      ['later', '100 workouts 31 of 100']
    ]);
    expect(root().querySelectorAll('app-theme-card .sub.gap').length).toBeGreaterThan(0);
    expect(root().querySelector('app-theme-card li[data-state="later"] .soft')).toBeTruthy();
  });

  it('puts the nodes of every path on the same five-slot columns, from the first', () => {
    render();

    for (const path of Array.from(root().querySelectorAll<HTMLElement>('app-theme-card .path'))) {
      const columns = Array.from(path.querySelectorAll<HTMLElement>('li')).map((entry) => entry.style.gridColumn.split('/')[0].trim());
      expect(columns).toEqual(columns.map((_, index) => String(index + 1)));
    }
  });

  it('runs the green line up to the last earned node and the slate line along the path', () => {
    render();
    const path = root().querySelector<HTMLElement>('app-theme-card .path')!;

    // Four nodes, the second the last earned: 3 gaps of 20% and 1 gap of green.
    expect(path.querySelector<HTMLElement>('.line:not(.green)')?.style.width).toBe('60%');
    expect(path.querySelector<HTMLElement>('.line.green')?.style.width).toBe('20%');
  });

  it('opens the evidence sheet of an earned week node with the week strip and the Training log door', async () => {
    render();
    const week = Array.from(root().querySelectorAll<HTMLButtonElement>('app-theme-card button.node')).find((entry) => entry.textContent?.includes('A full week'))!;
    week.click();
    await flush();

    const sheet = root().querySelector('app-badge-sheet')!;
    expect(sheet.querySelector('h2')?.textContent).toBe('A full week');
    expect(clean(sheet.querySelector('.evidence'))).toBe('4 sessions in the week of 21 Sept');
    expect(Array.from(sheet.querySelectorAll('app-week-strip li')).map((entry) => entry.classList.contains('trained'))).toEqual([true, false, false, true, true, true, false]);
    expect(sheet.querySelector('.door')?.getAttribute('href')).toBe('/progress/training#log');
    expect(clean(sheet.querySelector('.door'))).toBe('From your Training log');
    expect(clean(sheet.querySelector('.earned'))).toBe('Earned 27 Sept');
  });

  it('opens the gap sheet of the next node with the gap, the pace and the sessions door', async () => {
    render();
    const next = Array.from(root().querySelectorAll<HTMLButtonElement>('app-theme-card button.node')).find((entry) => entry.textContent?.includes('50 workouts'))!;
    next.click();
    await flush();

    const sheet = root().querySelector('app-badge-sheet')!;
    expect(clean(sheet.querySelector('.gap'))).toBe('19 to go');
    expect(clean(sheet.querySelector('.count'))).toBe('31 of 50 workouts');
    expect(clean(sheet.querySelector('.pace'))).toBe('At four a week, about five weeks');
    expect(sheet.querySelector('.door')?.getAttribute('href')).toBe('/workout?tab=history');
    expect(clean(sheet.querySelector('.door'))).toBe('Your sessions');
  });

  it('closes a sheet from Close, and a later node opens nothing', async () => {
    render();
    const later = root().querySelector<HTMLElement>('app-theme-card li[data-state="later"] .node')!;
    expect(later.tagName).toBe('DIV');
    later.click();
    await flush();
    expect(root().querySelector('app-badge-sheet')).toBeNull();

    root().querySelector<HTMLButtonElement>('app-theme-card button.node')!.click();
    await flush();
    expect(root().querySelector('app-badge-sheet')).toBeTruthy();
    root().querySelector<HTMLButtonElement>('app-badge-sheet .close')!.click();
    await flush();
    expect(root().querySelector('app-badge-sheet')).toBeNull();
  });

  it('opens a sheet with no strip when the footprint fails', async () => {
    data.getFootprint.and.returnValue(throwError(() => new Error('down')));
    render();
    const week = Array.from(root().querySelectorAll<HTMLButtonElement>('app-theme-card button.node')).find((entry) => entry.textContent?.includes('A full week'))!;
    week.click();
    await flush();

    expect(root().querySelector('app-badge-sheet')).toBeTruthy();
    expect(Array.from(root().querySelectorAll('app-badge-sheet app-week-strip li')).filter((entry) => entry.classList.contains('trained')).length).toBe(0);
  });

  it('shows the Earlier badges row only when there are earlier badges, and the footnote', () => {
    render();
    expect(root().querySelector('.earlier')).toBeNull();
    expect(root().querySelector('.footnote')?.textContent).toBe(FOOTNOTE);

    fixture.destroy();
    render({ ...BADGES, earlier: [node('STREAK_7', '7-day streak', 'SHOWING_UP', [7, 7, 'days'], '2026-09-01')] });
    expect(clean(root().querySelector('.earlier'))).toBe('EARLIER BADGES 7-day streak 1 Sept');
  });

  it('says so with a retry when the badges cannot be loaded', () => {
    data.getBadges.and.returnValue(throwError(() => new Error('down')));
    fixture = TestBed.createComponent(AchievementsPage);
    fixture.detectChanges();

    expect(root().querySelector('app-state-panel')).toBeTruthy();
    expect(root().querySelector('app-theme-card')).toBeNull();

    data.getBadges.and.returnValue(of(BADGES));
    root().querySelector<HTMLButtonElement>('app-state-panel button')!.click();
    fixture.detectChanges();
    expect(root().querySelectorAll('app-theme-card').length).toBe(4);
  });
});
