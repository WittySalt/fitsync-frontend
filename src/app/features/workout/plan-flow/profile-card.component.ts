import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

import { PlanProfile } from './plan-draft';
import { EQUIPMENT_OPTIONS, FOCUS_OPTIONS, LEVEL_OPTIONS, profileLine, profileProblem } from './plan-profile';

/** The "From your profile" card: one line from the profile and an inline form that writes the five fields back. */
@Component({
  selector: 'app-plan-profile-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile-card.component.html',
  styleUrl: './profile-card.component.scss'
})
export class ProfileCardComponent {
  readonly profile = input.required<PlanProfile>();
  readonly saving = input(false);
  readonly error = input<string | null>(null);
  readonly save = output<PlanProfile>();

  protected readonly open = signal(false);
  protected readonly draft = signal<PlanProfile | null>(null);
  protected readonly localError = signal<string | null>(null);
  protected readonly line = computed(() => profileLine(this.profile()));
  protected readonly levels = LEVEL_OPTIONS;
  protected readonly equipment = EQUIPMENT_OPTIONS;
  protected readonly focus = FOCUS_OPTIONS;

  private wasSaving = false;

  constructor() {
    // The form closes by itself once a save has finished without an error.
    effect(() => {
      const saving = this.saving();
      if (this.wasSaving && !saving && !this.error()) {
        this.open.set(false);
      }
      this.wasSaving = saving;
    });
  }

  protected edit(): void {
    this.draft.set({ ...this.profile(), equipment: [...this.profile().equipment], focusAreas: [...this.profile().focusAreas] });
    this.localError.set(null);
    this.open.set(true);
  }

  protected cancel(): void {
    this.open.set(false);
  }

  protected patch(change: Partial<PlanProfile>): void {
    this.draft.update((current) => (current ? { ...current, ...change } : current));
  }

  protected toggle(field: 'equipment' | 'focusAreas', value: string): void {
    const current = this.draft();
    if (!current) {
      return;
    }
    const has = current[field].includes(value);
    let next = has ? current[field].filter((item) => item !== value) : [...current[field], value];
    if (field === 'equipment') {
      next = value === 'NONE' && !has ? ['NONE'] : next.filter((item) => item !== 'NONE' || value === 'NONE');
    }
    this.patch({ [field]: next });
  }

  protected has(field: 'equipment' | 'focusAreas', value: string): boolean {
    return this.draft()?.[field].includes(value) ?? false;
  }

  protected submit(): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }
    const problem = profileProblem(draft);
    this.localError.set(problem);
    if (!problem) {
      this.save.emit(draft);
    }
  }
}
