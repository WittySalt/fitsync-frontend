import { Component, computed, input, model } from '@angular/core';

/** A number the person can nudge before saving: two 44 px buttons around the value. */
@Component({
  selector: 'app-player-stepper',
  template: `
    <div class="stepper" role="group" [attr.aria-label]="label()">
      <span class="title">{{ label() }}@if (unit()) { ({{ unit() }}) }</span>
      <div class="row">
        <button type="button" class="knob" [attr.aria-label]="'Less ' + lower()" [disabled]="value() <= min()" (click)="nudge(-1)">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14"></path></svg>
        </button>
        <output class="value">{{ shown() }}</output>
        <button type="button" class="knob" [attr.aria-label]="'More ' + lower()" [disabled]="value() >= max()" (click)="nudge(1)">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
        </button>
      </div>
    </div>
  `,
  styleUrl: './player-stepper.component.scss'
})
export class PlayerStepperComponent {
  readonly label = input.required<string>();
  readonly unit = input('');
  readonly value = model.required<number>();
  readonly step = input(1);
  readonly min = input(0);
  readonly max = input(9999);
  /** "clock" shows seconds as minutes and seconds. */
  readonly format = input<'number' | 'clock'>('number');

  protected readonly lower = computed(() => this.label().toLowerCase());
  protected readonly shown = computed(() => {
    const value = this.value();
    if (this.format() === 'clock') {
      return `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`;
    }
    return String(Math.round(value * 100) / 100);
  });

  protected nudge(direction: 1 | -1): void {
    const next = Math.round((this.value() + direction * this.step()) * 100) / 100;
    this.value.set(Math.min(this.max(), Math.max(this.min(), next)));
  }
}
