import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-state-panel',
  imports: [],
  template: `
    <section class="state-panel" [attr.aria-live]="error ? 'polite' : null">
      <strong>{{ title }}</strong>
      <p>{{ message }}</p>
      @if (actionLabel) {
        <button class="button secondary" type="button" (click)="action.emit()">{{ actionLabel }}</button>
      }
    </section>
  `
})
export class StatePanelComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) message = '';
  @Input() actionLabel = '';
  @Input() error = false;
  @Output() action = new EventEmitter<void>();
}

