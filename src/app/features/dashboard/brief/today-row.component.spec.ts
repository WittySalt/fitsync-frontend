import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CarriedOverDay, DayInsight, NextTraining, TodayInsight } from '../../../core/fitsync.models';
import { TodayRowComponent } from './today-row.component';

function today(overrides: Partial<TodayInsight>): TodayInsight {
  return {
    date: '2026-09-30',
    kind: 'STRENGTH',
    label: 'Strength',
    source: 'PLAN',
    planDayId: 'pd-1',
    title: 'Full body',
    estimatedMinutes: 50,
    moves: 4,
    lastOfKind: null,
    carriedOver: [],
    ...overrides
  };
}

function dayInsight(overrides: Partial<DayInsight>): DayInsight {
  return {
    date: '2026-09-30',
    dayOfWeek: 3,
    kind: 'STRENGTH',
    label: 'Strength',
    source: 'DONE',
    minutes: 50,
    sessions: [],
    planned: null,
    ...overrides
  };
}

describe('TodayRowComponent', () => {
  let fixture: ComponentFixture<TodayRowComponent>;

  function setup(overrides: Partial<TodayInsight>, extra: { todayDay?: DayInsight | null; nextTraining?: NextTraining | null; afterDark?: boolean; starting?: boolean; startError?: string | null } = {}): void {
    fixture = TestBed.createComponent(TodayRowComponent);
    fixture.componentRef.setInput('today', today(overrides));
    fixture.componentRef.setInput('todayDay', extra.todayDay ?? null);
    fixture.componentRef.setInput('nextTraining', extra.nextTraining ?? null);
    fixture.componentRef.setInput('afterDark', extra.afterDark ?? false);
    fixture.componentRef.setInput('starting', extra.starting ?? false);
    fixture.componentRef.setInput('startError', extra.startError ?? null);
    fixture.detectChanges();
  }

  function text(selector: string): string | null {
    return (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.trim() ?? null;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TodayRowComponent] }).compileComponents();
  });

  it('renders the plan row for a strength day: moves and duration, start button, train-elsewhere link', () => {
    setup({ kind: 'STRENGTH', source: 'PLAN', title: 'Full body', estimatedMinutes: 50, moves: 4 });
    expect(text('.today-row-label')).toBe('Today in your plan');
    expect(text('.today-row-name')).toBe('Full body');
    expect(text('.today-row-meta')).toBe('4 moves · 50 min');
    expect(text('.today-row-button')).toContain('Start session');
    expect(text('.today-row-link')).toBe('Train something else');
  });

  it('renders the cardio plan meta with last time\'s distance ahead of the planned duration', () => {
    setup({
      kind: 'CARDIO',
      source: 'PLAN',
      estimatedMinutes: 35,
      lastOfKind: { date: '2026-09-23', minutes: 34, distanceKm: 5.5, paceSecondsPerKm: 370 }
    });
    expect(text('.today-row-meta')).toBe('5.5 km last time · 35 min');
  });

  it('drops to just the duration when a cardio plan day has no last-time distance', () => {
    setup({ kind: 'CARDIO', source: 'PLAN', estimatedMinutes: 35, lastOfKind: null });
    expect(text('.today-row-meta')).toBe('35 min');
  });

  it('renders the sport plan meta from the last session\'s own duration', () => {
    setup({
      kind: 'SPORT',
      source: 'PLAN',
      label: 'Badminton',
      estimatedMinutes: 60,
      lastOfKind: { date: '2026-09-23', minutes: 45, distanceKm: null, paceSecondsPerKm: null }
    });
    expect(text('.today-row-meta')).toBe('45 min last time');
  });

  it('renders the habit row from the label, not the title, with the last-time meta', () => {
    setup({
      kind: 'CARDIO',
      source: 'HABIT',
      label: 'Cardio',
      title: null,
      lastOfKind: { date: '2026-09-23', minutes: 34, distanceKm: 5.5, paceSecondsPerKm: 370 }
    });
    expect(text('.today-row-label')).toBe('Your usual');
    expect(text('.today-row-name')).toBe('Cardio');
    expect(text('.today-row-meta')).toBe('5.5 km · 34 min last time');
  });

  it('leaves the habit meta empty, not "null", when there is no last-time record', () => {
    setup({ kind: 'CARDIO', source: 'HABIT', label: 'Cardio', lastOfKind: null });
    expect(fixture.nativeElement.querySelector('.today-row-meta')).toBeNull();
  });

  it('renders the in-progress row with a Continue button and no link', () => {
    setup({ kind: 'STRENGTH', source: 'IN_PROGRESS', title: 'Full body' });
    expect(text('.today-row-label')).toBe('In progress');
    expect(text('.today-row-button')).toContain('Continue');
    expect(fixture.nativeElement.querySelector('.today-row-link')).toBeNull();
  });

  it('renders the done row with distance, duration and derived pace for a cardio session', () => {
    setup(
      { kind: 'CARDIO', source: 'DONE', title: 'Morning run' },
      {
        todayDay: dayInsight({
          kind: 'CARDIO',
          minutes: 35,
          sessions: [{ sessionId: 's1', kind: 'CARDIO', label: 'Cardio', sportActivity: null, status: 'COMPLETED', minutes: 35, distanceKm: 5.75, planDayId: null }]
        })
      }
    );
    expect(text('.today-row-label')).toBe('Done today');
    expect(text('.today-row-meta')).toBe('5.75 km · 35 min · 6:05 per km');
    expect(fixture.nativeElement.querySelector('.today-row-button')).toBeNull();
    expect(text('.today-row-link')).toBe('See the session');
  });

  it('renders the done row with just the duration for a non-cardio or distance-less session', () => {
    setup({ kind: 'STRENGTH', source: 'DONE', title: 'Full body' }, { todayDay: dayInsight({ kind: 'STRENGTH', minutes: 50 }) });
    expect(text('.today-row-meta')).toBe('50 min');
  });

  it('renders the rest row pointing at the next training day', () => {
    setup(
      { kind: 'REST', source: 'PLAN' },
      { nextTraining: { date: '2026-10-01', kind: 'CARDIO', label: 'Cardio', title: 'Treadmill run', estimatedMinutes: 35 } }
    );
    expect(text('.today-row-label')).toBe('Rest today');
    expect(text('.today-row-name')).toBe('Next is Thursday, cardio');
    expect(text('.today-row-meta')).toBe('Treadmill run · 35 min');
    expect(fixture.nativeElement.querySelector('.today-row-button')).toBeNull();
    expect(text('.today-row-link')).toBe('Train today');
  });

  it('renders "Nothing planned" and an empty meta for a rest day with no next training in sight', () => {
    setup({ kind: 'REST', source: 'PLAN' }, { nextTraining: null });
    expect(text('.today-row-name')).toBe('Nothing planned');
    expect(fixture.nativeElement.querySelector('.today-row-meta')).toBeNull();
  });

  it('renders the open row with its fixed copy and a browse-plans link', () => {
    setup({ kind: 'OPEN', source: 'NONE', label: '' });
    expect(text('.today-row-label')).toBe('No plan yet');
    expect(text('.today-row-name')).toBe('Pick a plan');
    expect(text('.today-row-meta')).toBe('It says what each day is for.');
    expect(fixture.nativeElement.querySelector('.today-row-button')).toBeNull();
    expect(text('.today-row-link')).toBe('Browse plans');
  });

  it('shows the first carried-over day instead of the plain rest reading, with its own start button', () => {
    const carriedOver: CarriedOverDay[] = [
      { planDayId: 'pd-9', dayOfWeek: 1, kind: 'STRENGTH', title: 'Full body', estimatedMinutes: 50 },
      { planDayId: 'pd-10', dayOfWeek: 2, kind: 'CARDIO', title: 'Easy run', estimatedMinutes: 30 }
    ];
    setup({ kind: 'REST', source: 'PLAN', carriedOver });
    expect(text('.today-row-label')).toBe('Still open from Monday');
    expect(text('.today-row-name')).toBe('Full body');
    expect(text('.today-row-meta')).toBe('50 min');
    expect(text('.today-row-button')).toContain('Start session');
    expect(text('.today-row-link')).toBe('Train something else');
  });

  it('hides a start-button row after dark', () => {
    setup({ kind: 'STRENGTH', source: 'PLAN' }, { afterDark: true });
    expect(fixture.nativeElement.querySelector('.today-row')).toBeNull();
  });

  it('keeps showing the done row after dark', () => {
    setup({ kind: 'STRENGTH', source: 'DONE' }, { afterDark: true, todayDay: dayInsight({ kind: 'STRENGTH', minutes: 50 }) });
    expect(fixture.nativeElement.querySelector('.today-row')).toBeTruthy();
  });

  it('keeps showing the in-progress row after dark', () => {
    setup({ kind: 'STRENGTH', source: 'IN_PROGRESS' }, { afterDark: true });
    expect(fixture.nativeElement.querySelector('.today-row')).toBeTruthy();
  });

  it('keeps showing the rest row after dark', () => {
    setup({ kind: 'REST', source: 'PLAN' }, { afterDark: true });
    expect(fixture.nativeElement.querySelector('.today-row')).toBeTruthy();
  });

  it('disables the start button and shows the error message while starting', () => {
    setup({ kind: 'STRENGTH', source: 'PLAN' }, { starting: true, startError: 'Unable to start this session. Please retry.' });
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.today-row-button');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Starting…');
    expect(text('.today-row-error')).toBe('Unable to start this session. Please retry.');
  });

  it('emits startSession with the plan day id when the start button is clicked', () => {
    setup({ kind: 'STRENGTH', source: 'PLAN', planDayId: 'pd-1' });
    const emitted: (string | null)[] = [];
    fixture.componentInstance.startSession.subscribe((value) => emitted.push(value));
    (fixture.nativeElement.querySelector('.today-row-button') as HTMLButtonElement).click();
    expect(emitted).toEqual(['pd-1']);
  });

  it('emits goToWorkout when the continue button is clicked', () => {
    setup({ kind: 'STRENGTH', source: 'IN_PROGRESS' });
    let emitted = 0;
    fixture.componentInstance.goToWorkout.subscribe(() => emitted++);
    (fixture.nativeElement.querySelector('.today-row-button') as HTMLButtonElement).click();
    expect(emitted).toBe(1);
  });

  it('emits goToWorkout, not browsePlans, when the train-elsewhere link is clicked', () => {
    setup({ kind: 'STRENGTH', source: 'PLAN' });
    let workoutEmits = 0;
    let plansEmits = 0;
    fixture.componentInstance.goToWorkout.subscribe(() => workoutEmits++);
    fixture.componentInstance.browsePlans.subscribe(() => plansEmits++);
    (fixture.nativeElement.querySelector('.today-row-link') as HTMLAnchorElement).click();
    expect(workoutEmits).toBe(1);
    expect(plansEmits).toBe(0);
  });

  it('emits browsePlans when the browse-plans link is clicked', () => {
    setup({ kind: 'OPEN', source: 'NONE' });
    let emitted = 0;
    fixture.componentInstance.browsePlans.subscribe(() => emitted++);
    (fixture.nativeElement.querySelector('.today-row-link') as HTMLAnchorElement).click();
    expect(emitted).toBe(1);
  });
});
