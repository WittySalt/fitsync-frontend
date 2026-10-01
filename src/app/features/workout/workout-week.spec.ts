import { TestBed } from '@angular/core/testing';

import { DayInsight, WeeklyTrainingInsight, WorkoutSession } from '../../core/fitsync.models';
import { WorkoutWeekComponent } from './workout-week.component';
import { lastLine, lastTitle, weekCount, weekRangeLabel, weekTiles } from './workout-week';

function day(date: string, dayOfWeek: number, overrides: Partial<DayInsight> = {}): DayInsight {
  return { date, dayOfWeek, kind: 'OPEN', label: '', source: 'NONE', minutes: null, sessions: [], planned: null, ...overrides };
}

function week(): WeeklyTrainingInsight {
  return {
    timezone: 'Asia/Singapore',
    referenceDate: '2026-10-02',
    weekStart: '2026-09-28',
    weekEnd: '2026-10-04',
    completedSessions: 3,
    totalMinutes: 105,
    previousWeekCompletedSessions: 2,
    previousWeekTotalMinutes: 90,
    muscleGroups: [],
    volume: {} as WeeklyTrainingInsight['volume'],
    days: [
      day('2026-09-28', 1, { kind: 'STRENGTH', source: 'DONE', minutes: 50,
        sessions: [{ sessionId: 's1', kind: 'STRENGTH', label: 'Strength' } as DayInsight['sessions'][number]],
        planned: { planDayId: 'p1', kind: 'STRENGTH', title: 'Full Body', sportActivity: null, estimatedMinutes: 50, moves: 4, fulfilled: true } }),
      day('2026-09-29', 2, { kind: 'CARDIO', source: 'DONE', minutes: 35,
        sessions: [{ sessionId: 's2', kind: 'CARDIO', label: 'Cardio' } as DayInsight['sessions'][number]] }),
      day('2026-09-30', 3, { kind: 'REST', source: 'NONE' }),
      day('2026-10-01', 4, { kind: 'MOBILITY', source: 'DONE', minutes: 20,
        sessions: [{ sessionId: 's3', kind: 'MOBILITY', label: 'Mobility' } as DayInsight['sessions'][number]] }),
      day('2026-10-02', 5, { kind: 'REST', source: 'NONE' }),
      day('2026-10-03', 6, { kind: 'SPORT', source: 'PLAN',
        planned: { planDayId: 'p2', kind: 'SPORT', title: 'Badminton', sportActivity: 'BADMINTON', estimatedMinutes: 60, moves: null, fulfilled: false } }),
      day('2026-10-04', 7, { kind: 'STRENGTH', source: 'HABIT' })
    ],
    today: { date: '2026-10-02', kind: 'REST', label: 'Rest', source: 'NONE', planDayId: null, title: null, estimatedMinutes: null,
      moves: null, lastOfKind: null, carriedOver: [] },
    nextTraining: null
  };
}

function last(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    sessionId: 'session-last',
    name: 'Cardio — Treadmill',
    workoutType: 'CARDIO',
    kind: 'CARDIO',
    status: 'COMPLETED',
    startedAt: '2026-09-29T11:00:00Z',
    completedAt: '2026-09-29T11:35:00Z',
    durationMinutes: 35,
    caloriesBurned: null,
    exerciseCount: 1,
    ...overrides
  };
}

describe('the week of the Workout page', () => {
  it('draws each day as trained, today, planned or nothing, Monday first', () => {
    const tiles = weekTiles(week());

    expect(tiles.map((tile) => `${tile.weekday}:${tile.state}:${tile.kind ?? '-'}:${tile.caption}`)).toEqual([
      'Mon:done:STRENGTH:50 min',
      'Tue:done:CARDIO:35 min',
      'Wed:none:-:',
      'Thu:done:MOBILITY:20 min',
      'Fri:today:REST:Today',
      'Sat:planned:SPORT:',
      'Sun:planned:STRENGTH:'
    ]);
    expect(weekTiles(null)).toEqual([]);
  });

  it('counts the days trained against the days trained or still ahead, and gives the range of the week', () => {
    expect(weekCount(week())).toBe('3 of 5');
    expect(weekCount({ ...week(), days: week().days!.slice(0, 5) })).toBe('3');
    expect(weekCount({ ...week(), days: [] })).toBe('3');
    expect(weekRangeLabel(week())).toBe('28 Sept to 4 Oct');
  });

  it('names the last session by its kind and name with one kind of separator', () => {
    expect(lastTitle(last())).toBe('Cardio · Treadmill');
    expect(lastTitle(last({ name: 'Treadmill' }))).toBe('Cardio · Treadmill');
    expect(lastTitle(last({ name: 'Cardio' }))).toBe('Cardio');
    expect(lastTitle(last({ kind: 'SPORT', sportLabel: 'Badminton', name: 'Sport' }))).toBe('Sport · Badminton');
    expect(lastLine(last())).toBe('Tue 29 Sept · 35 min');
  });
});

describe('WorkoutWeekComponent', () => {
  it('shows the days, the two figures and the last session, which opens its page', () => {
    const fixture = TestBed.createComponent(WorkoutWeekComponent);
    fixture.componentRef.setInput('insight', week());
    fixture.componentRef.setInput('total', 32);
    fixture.componentRef.setInput('last', last());
    const opened = jasmine.createSpy('open');
    fixture.componentInstance.openSession.subscribe(opened);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.day').length).toBe(7);
    expect(root.querySelector('.day:nth-child(5)')?.getAttribute('aria-label')).toBe('Fri, today');
    expect(Array.from(root.querySelectorAll('.figure strong')).map((node) => node.textContent?.trim())).toEqual(['3 of 5', '32']);
    expect(root.querySelector('.last-text strong')?.textContent?.trim()).toBe('Cardio · Treadmill');

    root.querySelector<HTMLButtonElement>('.last')?.click();
    expect(opened).toHaveBeenCalledWith(jasmine.objectContaining({ sessionId: 'session-last' }));
  });

  it('leaves out the last session when there is none yet', () => {
    const fixture = TestBed.createComponent(WorkoutWeekComponent);
    fixture.componentRef.setInput('insight', week());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.last')).toBeNull();
  });
});
