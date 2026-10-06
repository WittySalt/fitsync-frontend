import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AccountDataService, AccountPreferences } from '../../../core/account-data.service';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { ToastService } from '../../../core/toast/toast.service';
import { AboutField } from './about-you';
import { AboutSheetComponent, toggled } from './about-sheet.component';

const preferences = {
  app: { preferredUnits: '100001', language: '110001', timezone: null, privacyLevel: '120001', dataSharingConsent: false },
  training: {
    fitnessLevel: '200002',
    trainingLocation: '210002',
    weeklyWorkoutDays: 4,
    preferredDurationMinutes: 45,
    preferredWorkoutTime: '19:00:00',
    intensityPreference: '220002',
    equipmentInventory: ['230002'],
    focusAreas: ['240002', '240004']
  },
  nutrition: { dietaryPattern: '300001', mealFrequency: 4, calorieTrackingMode: '310002', macroPreference: '320001', waterGoalMl: 2500 },
  notifications: {}
} as unknown as AccountPreferences;

describe('AboutSheetComponent', () => {
  let account: jasmine.SpyObj<AccountDataService>;
  let data: jasmine.SpyObj<FitSyncDataService>;
  let toast: jasmine.SpyObj<ToastService>;
  let fixture: ComponentFixture<AboutSheetComponent>;

  beforeEach(() => {
    account = jasmine.createSpyObj<AccountDataService>('AccountDataService', ['updatePreferences']);
    account.updatePreferences.and.returnValue(of(preferences));
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['saveInjuryAreas']);
    data.saveInjuryAreas.and.returnValue(of([]));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AccountDataService, useValue: account },
        { provide: FitSyncDataService, useValue: data },
        { provide: ToastService, useValue: toast }
      ]
    });
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const flush = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function open(field: AboutField, extra: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(AboutSheetComponent);
    fixture.componentRef.setInput('field', field);
    fixture.componentRef.setInput('preferences', preferences);
    for (const [name, value] of Object.entries(extra)) {
      fixture.componentRef.setInput(name, value);
    }
    await flush();
  }

  it('toggles a chip and keeps None apart from the other equipment', () => {
    expect(toggled(['A'], 'B')).toEqual(['A', 'B']);
    expect(toggled(['A', 'B'], 'A')).toEqual(['B']);
    expect(toggled(['DUMBBELLS'], 'NONE', 'NONE')).toEqual(['NONE']);
    expect(toggled(['NONE'], 'BARBELL', 'NONE')).toEqual(['BARBELL']);
  });

  describe('focus areas', () => {
    it('shows the chosen areas as pressed, by name, with Save filled and Cancel quiet', async () => {
      await open('focus');

      expect(root().querySelector('h2')?.textContent).toBe('Focus areas');
      const pressed = Array.from(root().querySelectorAll('.chip[aria-pressed="true"]')).map((chip) => chip.textContent?.trim());
      expect(pressed).toEqual(['Upper', 'Lower']);
      expect(root().querySelector('.save')).toBeTruthy();
      expect(root().querySelector('.cancel')?.textContent).toBe('Cancel');
    });

    it('saves the changed areas as the preference codes and keeps the rest of the training record', async () => {
      const saved = jasmine.createSpy('saved');
      await open('focus');
      fixture.componentInstance.saved.subscribe(saved);

      Array.from(root().querySelectorAll<HTMLButtonElement>('.chip')).find((chip) => chip.textContent?.trim() === 'Core')!.click();
      await flush();
      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      const sent = account.updatePreferences.calls.mostRecent().args[0];
      expect(sent.training.focusAreas).toEqual(['240002', '240004', '240003']);
      expect(sent.training.weeklyWorkoutDays).toBe(4);
      expect(sent.training.equipmentInventory).toEqual(['230002']);
      expect(sent.nutrition.dietaryPattern).toBe('300001');
      expect(toast.success).toHaveBeenCalled();
      expect(saved).toHaveBeenCalled();
    });

    it('stays open and says so when saving fails', async () => {
      account.updatePreferences.and.returnValue(throwError(() => new Error('down')));
      const saved = jasmine.createSpy('saved');
      await open('focus');
      fixture.componentInstance.saved.subscribe(saved);

      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      expect(toast.error).toHaveBeenCalledWith('Unable to save. Please retry.');
      expect(saved).not.toHaveBeenCalled();
    });

    it('closes from Cancel without saving', async () => {
      const dismissed = jasmine.createSpy('dismissed');
      await open('focus');
      fixture.componentInstance.dismissed.subscribe(dismissed);

      root().querySelector<HTMLButtonElement>('.cancel')!.click();

      expect(dismissed).toHaveBeenCalled();
      expect(account.updatePreferences).not.toHaveBeenCalled();
    });
  });

  describe('training days', () => {
    it('starts from the preference, steps within one to seven and saves the number', async () => {
      await open('days');
      expect(root().querySelector('.days')?.textContent).toBe('4 days a week');

      root().querySelector<HTMLButtonElement>('button[aria-label="More days"]')!.click();
      await flush();
      expect(root().querySelector('.days')?.textContent).toBe('5 days a week');
      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      expect(account.updatePreferences.calls.mostRecent().args[0].training.weeklyWorkoutDays).toBe(5);
    });

    it('does not step below one or above seven', async () => {
      await open('days');
      const less = root().querySelector<HTMLButtonElement>('button[aria-label="Fewer days"]')!;
      for (let index = 0; index < 8; index++) {
        less.click();
      }
      await flush();
      expect(root().querySelector('.days')?.textContent).toBe('1 day a week');

      const more = root().querySelector<HTMLButtonElement>('button[aria-label="More days"]')!;
      for (let index = 0; index < 9; index++) {
        more.click();
      }
      await flush();
      expect(root().querySelector('.days')?.textContent).toBe('7 days a week');
    });
  });

  describe('usual meals', () => {
    it('are shown read-only from the diary, with no Save', async () => {
      await open('meals', { meals: [{ label: 'Breakfast', time: '07:30' }, { label: 'Dinner', time: '19:00' }] });

      expect(root().querySelector('.from-diary')?.textContent).toBe('From your diary');
      expect(Array.from(root().querySelectorAll('.meals li')).map((row) => (row as HTMLElement).innerText.replace(/\s+/g, ' ').trim())).toEqual(['Breakfast 07:30', 'Dinner 19:00']);
      expect(root().querySelector('.save')).toBeNull();
      expect(root().querySelector('input')).toBeNull();
      expect(root().querySelector('.cancel')?.textContent).toBe('Close');
    });
  });

  describe('the other fields', () => {
    it('saves the usual training time as a time with seconds, or clears it', async () => {
      await open('time');
      expect(root().querySelector<HTMLInputElement>('input[type="time"]')?.value).toBe('19:00');
      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();
      expect(account.updatePreferences.calls.mostRecent().args[0].training.preferredWorkoutTime).toBe('19:00:00');
    });

    it('saves the diet code', async () => {
      await open('diet');
      const select = root().querySelector<HTMLSelectElement>('select')!;
      select.value = '300004';
      select.dispatchEvent(new Event('change'));
      await flush();
      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      expect(account.updatePreferences.calls.mostRecent().args[0].nutrition.dietaryPattern).toBe('300004');
    });

    it('saves the equipment as codes', async () => {
      await open('equipment');
      Array.from(root().querySelectorAll<HTMLButtonElement>('.chip')).find((chip) => chip.textContent?.trim() === 'Bands')!.click();
      await flush();
      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      expect(account.updatePreferences.calls.mostRecent().args[0].training.equipmentInventory).toEqual(['230002', '230004']);
    });

    it('saves the injured areas through the health readiness call', async () => {
      await open('injuries', { injuries: ['KNEE'] });
      Array.from(root().querySelectorAll<HTMLButtonElement>('.chip')).find((chip) => chip.textContent?.trim() === 'Hip')!.click();
      await flush();
      root().querySelector<HTMLButtonElement>('.save')!.click();
      await flush();

      expect(data.saveInjuryAreas).toHaveBeenCalledWith(['KNEE', 'HIP']);
      expect(account.updatePreferences).not.toHaveBeenCalled();
    });
  });
});
