import { Component, OnInit, input, output, signal } from '@angular/core';

import { PlayerSetValuesComponent } from './player-set-values.component';
import { PlayerSet } from './player-targets';

/** What the person corrected a set to. */
export interface EditedSet {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
}

/**
 * The editor for one set that is already done or skipped, shown in the workout dialog: the same
 * steppers as before a set, starting from what was logged (or planned), with Save and Cancel.
 */
@Component({
  selector: 'app-set-editor',
  imports: [PlayerSetValuesComponent],
  template: `
    <app-player-set-values
      [timed]="timed"
      [hasReps]="hasReps"
      [hasWeight]="hasWeight"
      [stacked]="true"
      [(reps)]="reps"
      [(weight)]="weight"
      [(duration)]="duration"
    />
    <div class="choices">
      <button class="button primary save" type="button" [disabled]="saving()" (click)="onSave()">
        {{ saving() ? 'Saving...' : 'Save' }}
      </button>
      <button class="button secondary cancel" type="button" (click)="cancelled.emit()">Cancel</button>
    </div>
  `,
  styleUrl: './set-editor.component.scss'
})
export class SetEditorComponent implements OnInit {
  readonly set = input.required<PlayerSet>();
  readonly saving = input(false);
  readonly save = output<EditedSet>();
  readonly cancelled = output<void>();

  protected readonly reps = signal(1);
  protected readonly weight = signal(0);
  protected readonly duration = signal(30);
  protected hasReps = true;
  protected hasWeight = false;
  protected timed = false;
  /** What the steppers do not show is saved as it was, so a correction never clears it. */
  private kept: EditedSet = { reps: null, weightKg: null, durationSeconds: null };

  ngOnInit(): void {
    const { logged, target } = this.set();
    const positive = (value: number | null | undefined) => (value ?? 0) > 0;
    const reps = logged?.reps ?? target?.reps ?? null;
    const weightKg = logged?.weightKg ?? target?.weightKg ?? null;
    const seconds = logged?.durationSeconds ?? target?.durationSeconds ?? null;
    this.timed = !positive(reps) && positive(seconds);
    this.hasReps = !this.timed;
    this.hasWeight = this.hasReps && positive(weightKg);
    this.reps.set(positive(reps) ? (reps as number) : 1);
    this.weight.set(positive(weightKg) ? (weightKg as number) : 0);
    this.duration.set(positive(seconds) ? (seconds as number) : 30);
    this.kept = {
      reps: null,
      weightKg: positive(weightKg) ? weightKg : null,
      durationSeconds: logged?.durationSeconds ?? null
    };
  }

  protected onSave(): void {
    this.save.emit({
      reps: this.hasReps ? this.reps() : null,
      weightKg: this.hasWeight ? this.weight() : this.kept.weightKg,
      durationSeconds: this.timed ? this.duration() : this.kept.durationSeconds
    });
  }
}
