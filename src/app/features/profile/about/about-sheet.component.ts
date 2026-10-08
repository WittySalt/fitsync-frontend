import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { AccountDataService, AccountPreferences } from '../../../core/account-data.service';
import { FOCUS_AREA_CODES, FitSyncDataService, normalizeFocusAreas } from '../../../core/fitsync-data.service';
import { ToastService } from '../../../core/toast/toast.service';
import { EQUIPMENT_CODES, EQUIPMENT_OPTIONS, FOCUS_OPTIONS, equipmentNames } from '../../workout/plan-flow/plan-profile';
import { WorkoutModalComponent } from '../../workout/workout-modal.component';
import { AboutField } from './about-you';

export const INJURY_OPTIONS = [
  { value: 'LOWER_BACK', label: 'Lower back' },
  { value: 'KNEE', label: 'Knee' },
  { value: 'SHOULDER', label: 'Shoulder' },
  { value: 'HIP', label: 'Hip' },
  { value: 'ANKLE', label: 'Ankle' },
  { value: 'NECK', label: 'Neck' },
  { value: 'WRIST', label: 'Wrist' },
  { value: 'OTHER', label: 'Other' }
] as const;

export const DIET_OPTIONS = [
  { value: '300001', label: 'No dietary pattern' },
  { value: '300002', label: 'Halal' },
  { value: '300003', label: 'Vegetarian' },
  { value: '300004', label: 'Vegan' },
  { value: '300005', label: 'Keto' },
  { value: '300006', label: 'Low carbohydrate' }
] as const;

export const MIN_DAYS = 1;
export const MAX_DAYS = 7;
const MAX_INJURIES = 8;

const HEADINGS: Record<string, string> = {
  days: 'Training days',
  time: 'Usual training time',
  equipment: 'Equipment',
  focus: 'Focus areas',
  injuries: 'Injuries',
  diet: 'Diet',
  meals: 'Usual meals'
};

// The chips work with names and the stored record with codes, so this looks a name up by value; an unknown name is sent as it is.
function codeOf(table: Record<string, string>, name: string): string {
  return Object.entries(table).find(([, value]) => value === name)?.[0] ?? name;
}

/** Turns or clears one value in a list of chips; "None" in equipment excludes the others. */
export function toggled(list: readonly string[], value: string, exclusive?: string): string[] {
  if (list.includes(value)) {
    return list.filter((entry) => entry !== value);
  }
  if (exclusive && value === exclusive) {
    return [value];
  }
  return [...list.filter((entry) => entry !== exclusive), value];
}

/**
 * The edit sheet of one About you input. Each field reuses the preferences call of the settings
 * page (the whole record is sent with the one field changed) and the health readiness call for
 * injuries. The usual meals come from the diary, so that sheet only shows them.
 */
@Component({
  selector: 'app-about-sheet',
  imports: [FormsModule, WorkoutModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about-sheet.component.html',
  styleUrl: './about-sheet.component.scss'
})
export class AboutSheetComponent implements OnInit {
  private readonly account = inject(AccountDataService);
  private readonly data = inject(FitSyncDataService);
  private readonly toast = inject(ToastService);

  readonly field = input.required<AboutField>();
  readonly preferences = input.required<AccountPreferences>();
  readonly injuries = input<readonly string[]>([]);
  readonly meals = input<readonly { label: string; time: string }[]>([]);

  readonly saved = output<void>();
  readonly dismissed = output<void>();

  protected readonly equipmentOptions = EQUIPMENT_OPTIONS;
  protected readonly focusOptions = FOCUS_OPTIONS;
  protected readonly injuryOptions = INJURY_OPTIONS;
  protected readonly dietOptions = DIET_OPTIONS;

  protected readonly days = signal(4);
  protected readonly time = signal('');
  protected readonly diet = signal('300001');
  protected readonly picked = signal<string[]>([]);
  protected readonly busy = signal(false);
  protected readonly problem = signal<string | null>(null);

  protected readonly heading = computed(() => HEADINGS[this.field()] ?? 'About you');
  protected readonly readOnly = computed(() => this.field() === 'meals');

  ngOnInit(): void {
    const training = this.preferences().training;
    switch (this.field()) {
      case 'days':
        this.days.set(training?.weeklyWorkoutDays ?? 4);
        break;
      case 'time':
        this.time.set((training?.preferredWorkoutTime ?? '').slice(0, 5));
        break;
      case 'equipment':
        this.picked.set(equipmentNames(training?.equipmentInventory ?? []));
        break;
      case 'focus':
        this.picked.set(normalizeFocusAreas(training?.focusAreas));
        break;
      case 'injuries':
        this.picked.set([...this.injuries()]);
        break;
      case 'diet':
        this.diet.set(this.preferences().nutrition?.dietaryPattern || '300001');
        break;
    }
  }

  protected has(value: string): boolean {
    return this.picked().includes(value);
  }

  protected toggle(value: string): void {
    const field = this.field();
    if (field === 'injuries' && !this.has(value) && this.picked().length >= MAX_INJURIES) {
      return;
    }
    this.picked.update((list) => toggled(list, value, field === 'equipment' ? 'NONE' : undefined));
  }

  protected step(direction: 1 | -1): void {
    this.days.update((value) => Math.min(MAX_DAYS, Math.max(MIN_DAYS, value + direction)));
  }

  protected save(): void {
    if (this.busy()) {
      return;
    }
    const request = this.request();
    if (!request) {
      return;
    }
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.toast.success('Saved.');
        this.busy.set(false);
        this.saved.emit();
      },
      error: () => {
        this.toast.error('Unable to save. Please retry.');
        this.busy.set(false);
      }
    });
  }

  private request(): Observable<unknown> | null {
    const current = this.preferences();
    switch (this.field()) {
      case 'days':
        return this.account.updatePreferences({ ...current, training: { ...current.training, weeklyWorkoutDays: this.days() } });
      case 'time': {
        const value = this.time();
        if (value && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
          this.problem.set('Enter a time such as 19:00.');
          return null;
        }
        return this.account.updatePreferences({ ...current, training: { ...current.training, preferredWorkoutTime: value ? `${value}:00` : null } });
      }
      case 'equipment':
        return this.account.updatePreferences({
          ...current,
          training: { ...current.training, equipmentInventory: this.picked().map((name) => codeOf(EQUIPMENT_CODES, name)) }
        });
      case 'focus':
        return this.account.updatePreferences({
          ...current,
          training: { ...current.training, focusAreas: this.picked().map((name) => codeOf(FOCUS_AREA_CODES, name)) }
        });
      case 'diet':
        return this.account.updatePreferences({ ...current, nutrition: { ...current.nutrition, dietaryPattern: this.diet() } });
      case 'injuries':
        return this.data.saveInjuryAreas(this.picked());
      default:
        return null;
    }
  }
}
