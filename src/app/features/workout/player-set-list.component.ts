import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

import { PlayerSet, sameTarget, valuesLine } from './player-targets';

/** The sets of the exercise on screen: what the plan asks for and what was logged against it. */
@Component({
  imports: [NgTemplateOutlet],
  selector: 'app-player-set-list',
  templateUrl: './player-set-list.component.html',
  styleUrl: './player-set-list.component.scss'
})
export class PlayerSetListComponent implements OnChanges {
  @Input({ required: true }) sets: PlayerSet[] = [];
  @Input() currentSetNumber: number | null = null;
  /** What the person chose for the current set before starting it, shown in its row instead of the plan. */
  @Input() currentValues: string | null = null;
  /** Which exercise the sets belong to. Another exercise starts the list afresh, with nothing new in it. */
  @Input() scope = '';
  /** Done and skipped rows open an editor when asked to. */
  @Input() editable = false;
  @Output() readonly edit = new EventEmitter<number>();

  /** The sets that became done since the list last changed; their circle fills and the check draws in. */
  protected fresh: ReadonlySet<number> = new Set<number>();
  private doneBefore: ReadonlySet<number> | null = null;
  private scopeBefore = '';

  ngOnChanges(): void {
    const done = new Set(this.sets.filter((set) => !!set.logged && !set.skipped).map((set) => set.setNumber));
    const before = this.doneBefore;
    this.fresh = before && this.scopeBefore === this.scope
      ? new Set([...done].filter((setNumber) => !before.has(setNumber)))
      : new Set<number>();
    this.doneBefore = done;
    this.scopeBefore = this.scope;
  }

  planned(set: PlayerSet): string {
    return valuesLine(set.target) || 'No target';
  }

  done(set: PlayerSet): string {
    return valuesLine(set.logged);
  }

  /** What a screen reader says for a row that can be edited: "Set 1, 10 reps at 20 kg, done. Edit". */
  spoken(set: PlayerSet): string {
    if (set.skipped) {
      return `Set ${set.setNumber}, skipped. Edit`;
    }
    const logged = set.logged;
    const amount = (value: number) => String(Math.round(value * 100) / 100);
    const values = logged?.reps != null
      ? `${amount(logged.reps)} reps${logged.weightKg != null ? ` at ${amount(logged.weightKg)} kg` : ''}`
      : valuesLine(logged);
    return `Set ${set.setNumber}, ${values ? `${values}, ` : ''}done. Edit`;
  }

  differs(set: PlayerSet): boolean {
    return !!set.logged && !!set.target && !!this.done(set) && !sameTarget(set.target, set.logged);
  }
}
