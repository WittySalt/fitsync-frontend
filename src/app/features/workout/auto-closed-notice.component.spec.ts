import { TestBed } from '@angular/core/testing';

import { WorkoutSession } from '../../core/fitsync.models';
import { AutoClosedNoticeComponent } from './auto-closed-notice.component';

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    sessionId: 'session-1',
    name: 'Evening lift',
    workoutType: 'STRENGTH',
    status: 'COMPLETED',
    startedAt: '2026-10-01T10:30:00Z',
    completedAt: '2026-10-01T11:12:00Z',
    durationMinutes: 42,
    caloriesBurned: null,
    exerciseCount: 3,
    autoClosedAt: '2026-10-01T14:12:00Z',
    ...overrides
  };
}

const clock = (iso: string) => {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

describe('AutoClosedNoticeComponent', () => {
  function render(value: WorkoutSession) {
    const fixture = TestBed.createComponent(AutoClosedNoticeComponent);
    fixture.componentRef.setInput('session', value);
    fixture.detectChanges();
    return fixture;
  }

  it('says when the workout began and when it was saved', () => {
    const root = render(session()).nativeElement as HTMLElement;

    expect(root.querySelector('.text')?.textContent?.trim()).toBe(
      `Your workout from ${clock('2026-10-01T10:30:00Z')} was saved at ${clock('2026-10-01T11:12:00Z')}.`
    );
  });

  it('says that a cancelled workout had no set', () => {
    const root = render(session({ status: 'CANCELLED', completedAt: '' })).nativeElement as HTMLElement;

    expect(root.querySelector('.text')?.textContent?.trim()).toBe(
      `Your workout from ${clock('2026-10-01T10:30:00Z')} was closed with no set logged.`
    );
  });

  it('tells its owner when Edit or the dismiss control is pressed', () => {
    const fixture = render(session());
    const edit = jasmine.createSpy('edit');
    const dismissed = jasmine.createSpy('dismissed');
    fixture.componentInstance.edit.subscribe(edit);
    fixture.componentInstance.dismissed.subscribe(dismissed);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('.edit')?.click();
    root.querySelector<HTMLButtonElement>('.dismiss')?.click();

    expect(edit).toHaveBeenCalledTimes(1);
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.dismiss')?.getAttribute('aria-label')).toBe('Dismiss this note');
  });
});
