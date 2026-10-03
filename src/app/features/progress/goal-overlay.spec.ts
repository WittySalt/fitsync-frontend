import { Goal } from '../../core/fitsync.models';
import { GoalOverlay, NO_OVERLAY, applyOverlay, isPending, reflects, settle } from './goal-overlay';

function goal(overrides: Partial<Goal> = {}): Goal {
  return {
    goalType: 'WEIGHT',
    targetValue: 68,
    targetUnit: 'kg',
    targetDate: '2026-12-11',
    status: 'ACTIVE',
    progressRatio: 0.4,
    ...overrides
  };
}

describe('goal overlay', () => {
  it('lists the server goals as they are when nothing was changed', () => {
    const server = [goal({ goalType: 'PROTEIN' }), goal()];

    expect(applyOverlay(server, NO_OVERLAY).map((entry) => entry.goalType)).toEqual(['PROTEIN', 'WEIGHT']);
    expect(isPending(NO_OVERLAY)).toBeFalse();
  });

  it('shows the saved goal in place of the server one of the same type, and adds a new type', () => {
    const overlay: GoalOverlay = { saved: [goal({ targetValue: 66 }), goal({ goalType: 'CALORIES', targetValue: 2000 })], removed: new Set() };

    const shown = applyOverlay([goal()], overlay);

    expect(shown.map((entry) => `${entry.goalType}:${entry.targetValue}`)).toEqual(['CALORIES:2000', 'WEIGHT:66']);
  });

  it('hides a deleted type and a goal whose status is no longer listed', () => {
    const overlay: GoalOverlay = { saved: [], removed: new Set(['WEIGHT']) };

    expect(applyOverlay([goal(), goal({ goalType: 'FAT', status: 'CANCELLED' }), goal({ goalType: 'PROTEIN' })], overlay).map((entry) => entry.goalType)).toEqual([
      'PROTEIN'
    ]);
  });

  it('knows when the server shows what was saved', () => {
    expect(reflects([goal({ targetValue: 66 })], goal({ targetValue: 66 }))).toBeTrue();
    expect(reflects([goal({ targetValue: 68 })], goal({ targetValue: 66 }))).toBeFalse();
    expect(reflects([goal({ status: 'PAUSED' })], goal())).toBeFalse();
    expect(reflects([goal({ targetDate: '2027-01-01' })], goal())).toBeFalse();
    expect(reflects([], goal())).toBeFalse();
  });

  it('keeps a saved goal until the server shows it, and a deleted one until the server drops it', () => {
    const overlay: GoalOverlay = { saved: [goal({ targetValue: 66 })], removed: new Set(['PROTEIN']) };

    const waiting = settle([goal({ targetValue: 68 }), goal({ goalType: 'PROTEIN' })], overlay);
    expect(waiting.saved.length).toBe(1);
    expect([...waiting.removed]).toEqual(['PROTEIN']);
    expect(isPending(waiting)).toBeTrue();

    const settled = settle([goal({ targetValue: 66 })], overlay);
    expect(settled.saved).toEqual([]);
    expect(settled.removed.size).toBe(0);
    expect(isPending(settled)).toBeFalse();
  });
});
