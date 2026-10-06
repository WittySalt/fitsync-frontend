import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { UserGoal } from '../../../core/fitsync.models';
import { ToastService } from '../../../core/toast/toast.service';
import { TargetsCardComponent } from './targets-card.component';
import { TARGET_KINDS, buildTargetRequest, kindOf, missingMacro, stepValue, targetProblem, targetRows, targetText, unsetKinds } from './targets';

function goal(goalType: UserGoal['goalType'], targetValue: number | null, extra: Partial<UserGoal> = {}): UserGoal {
  return { goalId: goalType, goalType, targetValue, targetUnit: null, targetDate: null, status: 'ACTIVE', notes: null, ...extra };
}

const four: UserGoal[] = [
  goal('WEIGHT', 68, { targetUnit: 'kg', targetDate: '2026-12-11' }),
  goal('CALORIES', 2100, { targetUnit: 'kcal' }),
  goal('PROTEIN', 140, { targetUnit: 'g' }),
  goal('WORKOUT_FREQUENCY', 4, { targetUnit: 'sessions/week' })
];

describe('Targets', () => {
  describe('rows', () => {
    it('writes each target as the board does', () => {
      expect(targetRows(four).map((row) => [row.kind.label, row.text])).toEqual([
        ['Weight', '68 kg · by 11 Dec 2026'],
        ['Calories', '2,100 kcal a day'],
        ['Protein', '140 g a day'],
        ['Sessions', '4 a week']
      ]);
    });

    it('leaves out a target without a value and lists carbs and fat after the four', () => {
      const rows = targetRows([goal('FAT', 60), goal('WEIGHT', null), goal('CARBS', 250), ...four]);
      expect(rows.map((row) => row.kind.type)).toEqual(['WEIGHT', 'CALORIES', 'PROTEIN', 'WORKOUT_FREQUENCY', 'CARBS', 'FAT']);
      expect(targetText(goal('CARBS', 250))).toBe('250 g a day');
    });

    it('offers a carbs or fat target while one is unset', () => {
      expect(missingMacro(four)?.type).toBe('CARBS');
      expect(missingMacro([...four, goal('CARBS', 250)])?.type).toBe('FAT');
      expect(missingMacro([...four, goal('CARBS', 250), goal('FAT', 60)])).toBeNull();
      expect(unsetKinds([]).length).toBe(TARGET_KINDS.length);
    });
  });

  describe('the stepper and the request', () => {
    it('steps by the size of the kind and stays above its floor', () => {
      expect(stepValue(kindOf('WEIGHT'), 68, 1)).toBe(68.5);
      expect(stepValue(kindOf('CALORIES'), 2100, -1)).toBe(2050);
      expect(stepValue(kindOf('WORKOUT_FREQUENCY'), 1, -1)).toBe(1);
      expect(stepValue(kindOf('PROTEIN'), null, 1)).toBe(15);
    });

    it('asks for a number at or above the floor', () => {
      expect(targetProblem(kindOf('CALORIES'), null, '')).toBe('Enter a number of at least 500.');
      expect(targetProblem(kindOf('CALORIES'), 400, '')).toBe('Enter a number of at least 500.');
      expect(targetProblem(kindOf('CALORIES'), 2100, '')).toBeNull();
      expect(targetProblem(kindOf('CALORIES'), 2100, 'x'.repeat(301))).toBe('The note can be 300 characters at most.');
    });

    it('keeps the date for weight only, and the status of an existing target', () => {
      expect(buildTargetRequest(kindOf('WEIGHT'), four[0], 67, '2026-12-01', ' keep going ')).toEqual({
        targetValue: 67,
        targetUnit: 'kg',
        targetDate: '2026-12-01',
        status: 'ACTIVE',
        notes: 'keep going'
      });
      expect(buildTargetRequest(kindOf('PROTEIN'), null, 150, '2026-12-01', '').targetDate).toBeNull();
      expect(buildTargetRequest(kindOf('PROTEIN'), null, 150, '', '')).toEqual({ targetValue: 150, targetUnit: 'g', targetDate: null, status: 'ACTIVE', notes: null });
    });
  });

  describe('the card and its sheet', () => {
    let fixture: ComponentFixture<TargetsCardComponent>;
    let data: jasmine.SpyObj<FitSyncDataService>;
    let toast: jasmine.SpyObj<ToastService>;

    beforeEach(async () => {
      data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['upsertGoal', 'deleteGoal']);
      data.upsertGoal.and.returnValue(of(four[0]));
      data.deleteGoal.and.returnValue(of(undefined));
      toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
      await TestBed.configureTestingModule({
        imports: [TargetsCardComponent],
        providers: [provideRouter([]), { provide: FitSyncDataService, useValue: data }, { provide: ToastService, useValue: toast }]
      }).compileComponents();
      fixture = TestBed.createComponent(TargetsCardComponent);
    });

    afterEach(() => {
      fixture.destroy();
    });

    const root = () => fixture.nativeElement as HTMLElement;
    const flush = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const button = (selector: string) => root().querySelector<HTMLButtonElement>(selector)!;

    function show(goals: UserGoal[]): void {
      fixture.componentRef.setInput('goals', goals);
      fixture.detectChanges();
    }

    it('lists the targets with Change, a quiet carbs or fat line and the way to Progress', () => {
      show(four);

      expect(root().querySelectorAll('.row').length).toBe(4);
      expect(root().querySelector('.row .value')?.textContent).toBe('68 kg · by 11 Dec 2026');
      expect(root().querySelectorAll('.change').length).toBe(4);
      expect(root().querySelector('.quiet')?.textContent).toBe('Add a carbs or fat target');
      expect(root().querySelector('.open')?.getAttribute('href')).toBe('/progress/goal');
      expect(root().querySelector('#goal-lifecycle')).toBeTruthy();
    });

    it('shows no targets yet with a Set a target button on an empty account', () => {
      show([]);

      expect(root().querySelector('.none')?.textContent).toBe('No targets yet');
      expect(root().querySelector('.set')?.textContent).toBe('Set a target');
      expect(root().querySelector('.open')).toBeNull();
    });

    it('opens the sheet of a target with Save, Remove target and Cancel', async () => {
      show(four);
      button('.change').click();
      await flush();

      const sheet = root().querySelector('app-target-sheet')!;
      expect(sheet.querySelector('h2')?.textContent).toBe('Weight target');
      expect(sheet.querySelector<HTMLInputElement>('input[name="value"]')?.value).toBe('68');
      expect(Array.from(sheet.querySelectorAll('.actions button')).map((entry) => entry.textContent?.trim())).toEqual(['Save', 'Remove target', 'Cancel']);
      expect(sheet.querySelector('.remove')).toBeTruthy();
    });

    it('saves the stepped value and tells the page', async () => {
      const changed = jasmine.createSpy('changed');
      fixture.componentInstance.changed.subscribe(changed);
      show(four);
      button('.change').click();
      await flush();

      root().querySelector<HTMLButtonElement>('button[aria-label="More"]')!.click();
      await flush();
      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      expect(data.upsertGoal).toHaveBeenCalledWith('WEIGHT', { targetValue: 68.5, targetUnit: 'kg', targetDate: '2026-12-11', status: 'ACTIVE', notes: null });
      expect(toast.success).toHaveBeenCalledWith('Target saved.');
      expect(changed).toHaveBeenCalled();
      expect(root().querySelector('app-target-sheet')).toBeNull();
    });

    it('removes a target without a native dialog', async () => {
      const confirmSpy = spyOn(window, 'confirm');
      const changed = jasmine.createSpy('changed');
      fixture.componentInstance.changed.subscribe(changed);
      show(four);
      button('.change').click();
      await flush();

      root().querySelector<HTMLButtonElement>('.remove')!.click();
      await flush();

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(data.deleteGoal).toHaveBeenCalledWith('WEIGHT');
      expect(changed).toHaveBeenCalled();
    });

    it('keeps the sheet open and says so when saving fails', async () => {
      data.upsertGoal.and.returnValue(throwError(() => new Error('down')));
      show(four);
      button('.change').click();
      await flush();

      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      expect(toast.error).toHaveBeenCalledWith('Unable to save the target. Please retry.');
      expect(root().querySelector('app-target-sheet')).toBeTruthy();
    });

    it('refuses a value under the floor without calling the server', async () => {
      show(four);
      button('.change').click();
      await flush();
      const input = root().querySelector<HTMLInputElement>('input[name="value"]')!;
      input.value = '5';
      input.dispatchEvent(new Event('input'));
      await flush();

      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      expect(data.upsertGoal).not.toHaveBeenCalled();
      expect(root().querySelector('.problem')?.textContent).toContain('at least 20');
    });

    it('adds a carbs target from the quiet line, with no Remove button', async () => {
      show(four);
      button('.quiet').click();
      await flush();

      const sheet = root().querySelector('app-target-sheet')!;
      expect(sheet.querySelector('h2')?.textContent).toBe('Set a target');
      expect(sheet.querySelector('.remove')).toBeNull();
      expect(sheet.querySelector('.label')?.textContent).toContain('Carbs');
    });

    it('lets Set a target pick the kind on an empty account', async () => {
      show([]);
      button('.set').click();
      await flush();

      const kinds = Array.from(root().querySelectorAll('.kind')).map((entry) => entry.textContent?.trim());
      expect(kinds).toEqual(['Weight', 'Calories', 'Protein', 'Sessions', 'Carbs', 'Fat']);
      root().querySelectorAll<HTMLButtonElement>('.kind')[1].click();
      await flush();
      expect(root().querySelector('.label')?.textContent).toContain('Calories');
    });
  });
});
