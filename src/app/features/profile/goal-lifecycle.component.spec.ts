import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../core/fitsync-data.service';
import { GoalType, UserGoal } from '../../core/fitsync.models';
import { ToastService } from '../../core/toast/toast.service';
import { GoalLifecycleComponent } from './goal-lifecycle.component';

function goal(overrides: Partial<UserGoal> = {}): UserGoal {
  return {
    goalId: 'goal-1',
    goalType: 'WEIGHT',
    targetValue: 75,
    targetUnit: 'kg',
    targetDate: '2026-12-31',
    status: 'ACTIVE',
    notes: 'Cut slowly',
    ...overrides
  };
}

describe('GoalLifecycleComponent', () => {
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getGoals',
      'upsertGoal',
      'deleteGoal'
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    dataService.getGoals.and.returnValue(of([goal()]));
    dataService.deleteGoal.and.returnValue(of(void 0));
    dataService.upsertGoal.and.callFake((goalType: GoalType, request) =>
      of(
        goal({
          goalId: `goal-${goalType.toLowerCase()}`,
          goalType,
          targetValue: request.targetValue,
          targetUnit: request.targetUnit,
          targetDate: request.targetDate,
          status: request.status,
          notes: request.notes
        })
      )
    );

    await TestBed.configureTestingModule({
      imports: [GoalLifecycleComponent],
      providers: [
        { provide: FitSyncDataService, useValue: dataService },
        { provide: ToastService, useValue: toast }
      ]
    }).compileComponents();
  });

  it('renders all six goal types and an honest unset state', () => {
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Weight');
    expect(text).toContain('Calories');
    expect(text).toContain('Protein');
    expect(text).toContain('Carbs');
    expect(text).toContain('Fat');
    expect(text).toContain('Workout Frequency');
    expect(text).toContain('Not set');
    expect(text).toContain('75 kg');
    expect(text).not.toContain('0 kcal');
    expect(text).not.toContain('0 g');
  });

  it('defaults carbohydrate and fat goals to grams', () => {
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit('CARBS');
    expect(fixture.componentInstance.form.controls.targetUnit.value).toBe('g');

    fixture.componentInstance.startEdit('FAT');
    expect(fixture.componentInstance.form.controls.targetUnit.value).toBe('g');
  });

  it('upserts a goal with the selected goal type and form body', () => {
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit('CALORIES');
    fixture.componentInstance.form.setValue({
      targetValue: 2200,
      targetUnit: ' kcal ',
      targetDate: '2026-12-31',
      status: 'ACTIVE',
      notes: ' Maintenance '
    });
    fixture.componentInstance.saveGoal('CALORIES');

    expect(dataService.upsertGoal).toHaveBeenCalledWith('CALORIES', {
      targetValue: 2200,
      targetUnit: 'kcal',
      targetDate: '2026-12-31',
      status: 'ACTIVE',
      notes: 'Maintenance'
    });
    expect(toast.success).toHaveBeenCalledWith('Goal saved.');
  });

  it('switches status before saving', () => {
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit('PROTEIN');
    fixture.componentInstance.setStatus('COMPLETED');
    fixture.componentInstance.saveGoal('PROTEIN');

    expect(dataService.upsertGoal).toHaveBeenCalledWith(
      'PROTEIN',
      jasmine.objectContaining({ status: 'COMPLETED' })
    );
  });

  it('passes null target values for unset goals instead of a fake zero', () => {
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit('WORKOUT_FREQUENCY');
    fixture.componentInstance.form.patchValue({
      targetValue: null,
      targetUnit: '',
      targetDate: '',
      notes: ''
    });
    fixture.componentInstance.saveGoal('WORKOUT_FREQUENCY');

    expect(dataService.upsertGoal).toHaveBeenCalledWith(
      'WORKOUT_FREQUENCY',
      jasmine.objectContaining({
        targetValue: null,
        targetUnit: null,
        targetDate: null
      })
    );
  });

  it('soft-deletes a goal after confirmation and removes it locally', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteGoal('WEIGHT');

    expect(dataService.deleteGoal).toHaveBeenCalledWith('WEIGHT');
    expect(toast.success).toHaveBeenCalledWith('Goal deleted.');
    expect(fixture.componentInstance.goalFor('WEIGHT')).toBeNull();
    expect(fixture.componentInstance.deletingGoalType()).toBeNull();
  });

  it('does not delete when confirmation is dismissed', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteGoal('WEIGHT');

    expect(dataService.deleteGoal).not.toHaveBeenCalled();
    expect(fixture.componentInstance.goalFor('WEIGHT')).not.toBeNull();
  });

  it('surfaces delete failures through toast errors', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    dataService.deleteGoal.and.returnValue(throwError(() => new Error('nope')));
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteGoal('WEIGHT');

    expect(toast.error).toHaveBeenCalledWith('Unable to delete goal. Please retry.');
    expect(fixture.componentInstance.deletingGoalType()).toBeNull();
  });

  it('closes the edit form when the goal being edited is deleted', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit('WEIGHT');
    expect(fixture.componentInstance.editingGoalType()).toBe('WEIGHT');

    fixture.componentInstance.deleteGoal('WEIGHT');

    expect(fixture.componentInstance.editingGoalType()).toBeNull();
  });

  it('ignores a delete while one is already in flight', () => {
    const confirmSpy = spyOn(window, 'confirm').and.returnValue(true);
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.deletingGoalType.set('PROTEIN');
    fixture.componentInstance.deleteGoal('WEIGHT');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(dataService.deleteGoal).not.toHaveBeenCalled();
  });

  it('surfaces write failures through toast errors', () => {
    dataService.upsertGoal.and.returnValue(throwError(() => new Error('nope')));
    const fixture = TestBed.createComponent(GoalLifecycleComponent);
    fixture.detectChanges();

    fixture.componentInstance.startEdit('WEIGHT');
    fixture.componentInstance.saveGoal('WEIGHT');

    expect(toast.error).toHaveBeenCalledWith('Unable to save goal. Please retry.');
    expect(fixture.componentInstance.savingGoalType()).toBeNull();
  });
});
