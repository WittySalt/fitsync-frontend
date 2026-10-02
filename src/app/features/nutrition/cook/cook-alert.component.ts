import { Component, computed, input, output } from '@angular/core';

import { CookAlert } from './cook-session.service';

/** What the green bar says for a timer that ended on another step. */
export function alertText(alert: CookAlert): string {
  const step = alert.step + 1;
  if (alert.name !== null) {
    return `Step ${step}: ${alert.name || 'your timer'} is done`;
  }
  if (alert.kind === 'turn') {
    return `Step ${step}: the first side is done`;
  }
  return alert.eachSide ? `Step ${step}: both sides are done` : `Step ${step}: the timer is done`;
}

/** The next action of the alert: the second side starts from here, anything else opens the step. */
export function alertAction(alert: CookAlert): string {
  return alert.kind === 'turn' ? 'Start the second side' : `Go to step ${alert.step + 1}`;
}

/** A green bar across the top: a timer ended while you were on another step. It stays until answered. */
@Component({
  selector: 'app-cook-alert',
  template: `
    <div class="bar" role="alert">
      <span class="text">{{ text() }}</span>
      <button type="button" class="action" (click)="acted.emit()">{{ action() }}</button>
      <button type="button" class="later" (click)="later.emit()">Later</button>
    </div>
  `,
  styleUrl: './cook-alert.component.scss'
})
export class CookAlertComponent {
  readonly alert = input.required<CookAlert>();
  readonly acted = output<void>();
  readonly later = output<void>();

  protected readonly text = computed(() => alertText(this.alert()));
  protected readonly action = computed(() => alertAction(this.alert()));
}
