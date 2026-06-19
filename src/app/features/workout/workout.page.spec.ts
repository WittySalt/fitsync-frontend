import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { WorkoutPage } from './workout.page';
import { WorkoutSession } from '../../core/fitsync.models';

function session(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    name: 'Session',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '',
    durationMinutes: 0,
    caloriesBurned: 0,
    completedAt: '',
    exerciseCount: 0,
    ...overrides
  };
}

describe('WorkoutPage', () => {
  let component: WorkoutPage;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    component = TestBed.createComponent(WorkoutPage).componentInstance;
  });

  it('derives the latest session by completion time', () => {
    component.sessions.set([
      session({ name: 'Old', completedAt: '2026-06-10T10:00:00Z' }),
      session({ name: 'New', completedAt: '2026-06-18T10:00:00Z' })
    ]);

    expect(component.latestSession()?.name).toBe('New');
  });

  it('counts total and this-week sessions in the metric strip', () => {
    component.sessions.set([
      session({ name: 'recent', completedAt: new Date().toISOString() }),
      session({ name: 'old', completedAt: '2025-01-01T00:00:00Z' })
    ]);

    const metrics = component.metrics();
    expect(metrics[0].value).toBe('2');
    expect(metrics[1].value).toBe('1');
  });
});
