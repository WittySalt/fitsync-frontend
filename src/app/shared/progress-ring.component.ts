import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-progress-ring',
  imports: [],
  template: `
    <div class="ring" [style.--value]="percent + '%'" [attr.aria-label]="label + ' progress ' + percent + '%'">
      <span>{{ percent }}%</span>
    </div>
  `
})
export class ProgressRingComponent {
  @Input() label = 'Metric';
  @Input() set value(value: number) {
    this.percent = Math.max(0, Math.min(100, Math.round(value)));
  }

  percent = 0;
}
