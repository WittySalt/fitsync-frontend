import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { SessionRecordComponent } from './session-record.component';

function cancelledWithSets(done: number): WorkoutSessionDetail {
  return {
    sessionId: 'session-1',
    name: 'Full Body Strength',
    workoutType: 'STRENGTH',
    status: 'CANCELLED',
    startedAt: '2026-10-01T12:45:00Z',
    completedAt: '',
    endedAt: '2026-10-01T12:57:00Z',
    durationMinutes: 12,
    caloriesBurned: 70,
    caloriesEstimated: true,
    perceivedExertion: null,
    exerciseCount: 1,
    notes: '',
    createdAt: '',
    updatedAt: '',
    exercises: [{
      exerciseLogId: 'log-1', exerciseId: 'ex-1', exerciseNameSnapshot: 'Dumbbell Bench Press', sequence: 1,
      performedSets: done, performedReps: null, totalVolumeKg: null, distanceKm: null, durationSeconds: null,
      averageHeartRate: null, maxHeartRate: null, notes: '',
      sets: [1, 2, 3].map((setNumber) => ({
        setLogId: `s${setNumber}`, setNumber, status: setNumber <= done ? 'DONE' : 'PENDING', reps: 10, weightKg: 20,
        durationSeconds: null, distanceKm: null, restSeconds: 75, perceivedExertion: null, logged: setNumber <= done, notes: ''
      }))
    }]
  };
}

describe('SessionRecordComponent', () => {
  let fixture: ComponentFixture<SessionRecordComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  function mount(session: WorkoutSessionDetail): void {
    fixture = TestBed.createComponent(SessionRecordComponent);
    fixture.componentRef.setInput('session', session);
    fixture.detectChanges();
  }

  it('offers to count a cancelled session that has sets done, and says how many', () => {
    mount(cancelledWithSets(2));
    const count = jasmine.createSpy('count');
    fixture.componentInstance.count.subscribe(count);

    expect(root().querySelector('.count-bar span')?.textContent?.trim()).toBe('2 sets done, not counted in your totals');
    root().querySelector<HTMLButtonElement>('.count')?.click();
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('has nothing to count for a cancelled session without a set done or a completed one', () => {
    mount(cancelledWithSets(0));
    expect(root().querySelector('.count-bar')).toBeNull();
    expect(root().querySelector('.exercise.folded')?.textContent).toContain('0 of 3 sets');

    mount({ ...cancelledWithSets(2), status: 'COMPLETED' });
    expect(root().querySelector('.count-bar')).toBeNull();
  });

  it('marks each set and names the marks for a screen reader, with only the columns that hold something', () => {
    mount(cancelledWithSets(2));

    expect(Array.from(root().querySelectorAll('tbody .mark')).map((mark) => mark.getAttribute('aria-label')))
      .toEqual(['Done', 'Done', 'Not done']);
    expect(Array.from(root().querySelectorAll('thead th:not(.fill)')).map((cell) => cell.textContent?.trim()))
      .toEqual(['State', 'Set', 'Done', 'Rest']);
  });

  it('shows planned against actual for each segment, and nothing for a session without segments', () => {
    mount({
      ...cancelledWithSets(0),
      status: 'COMPLETED',
      exercises: [],
      segments: [
        { entryId: 'a', position: 1, kind: 'WARMUP', label: 'Warm-up', plannedSeconds: 300, actualSeconds: 300, startedAt: null, status: 'DONE' },
        { entryId: 'b', position: 2, kind: 'STEADY', label: 'Steady', plannedSeconds: 1200, actualSeconds: 1560, startedAt: null, status: 'DONE' },
        { entryId: 'c', position: 3, kind: 'COOLDOWN', label: 'Cool-down', plannedSeconds: 300, actualSeconds: null, startedAt: null, status: 'PENDING' }
      ]
    });
    const block = root().querySelector('.segments');
    expect(block).not.toBeNull();
    expect(block?.textContent).toContain('26:00 of 20:00');
    expect(block?.textContent).toContain('5:00');

    mount(cancelledWithSets(2));
    expect(root().querySelector('.segments')).toBeNull();
  });
});
