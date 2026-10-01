import { Component, Input } from '@angular/core';

import { PlayerSet, sameTarget, valuesLine } from './player-targets';

/** The sets of the exercise on screen: what the plan asks for and what was logged against it. */
@Component({
  selector: 'app-player-set-list',
  templateUrl: './player-set-list.component.html',
  styleUrl: './player-set-list.component.scss'
})
export class PlayerSetListComponent {
  @Input({ required: true }) sets: PlayerSet[] = [];
  @Input() currentSetNumber: number | null = null;

  planned(set: PlayerSet): string {
    return valuesLine(set.target) || 'No target';
  }

  done(set: PlayerSet): string {
    return valuesLine(set.logged);
  }

  differs(set: PlayerSet): boolean {
    return !!set.logged && !!set.target && !!this.done(set) && !sameTarget(set.target, set.logged);
  }
}
