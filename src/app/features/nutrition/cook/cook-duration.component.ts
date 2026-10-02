import { Component, OnInit, input, model, output, signal } from '@angular/core';

import { StepperComponent } from '../recipes/stepper.component';
import { MAX_MINUTES, MIN_MINUTES, addMinutes, nudge, parseDuration, splitMinutes } from './cook-duration';

/**
 * One way to choose a time, for a new timer, the time of a timer and the length before it starts.
 * Hours and minutes are two typed boxes; minutes over 59 roll into hours. Chips add a little or a
 * lot at once, Reset goes back to the recipe's time, and the round buttons nudge by 1 min under
 * 10 min, 5 min under an hour and 15 min above. The parent reads `minutes` and `valid`, and Enter in
 * a box reports `submitted` so the parent can start or set.
 */
@Component({
  selector: 'app-cook-duration',
  imports: [StepperComponent],
  template: `
    <app-stepper downLabel="Shorter" upLabel="Longer" [canDown]="minutes() > min" [canUp]="minutes() < max" (down)="nudged(-1)" (up)="nudged(1)">
      <span class="fields" role="group" aria-label="Time">
        <label>
          <span class="sr-only">Hours</span>
          <input type="text" inputmode="numeric" autocomplete="off" maxlength="4" [value]="hours()" [attr.aria-invalid]="!valid()" (input)="typed('h', $event)" (focus)="selectAll($event)" (change)="settle()" (keydown.enter)="enter($event)" />
          <span aria-hidden="true">h</span>
        </label>
        <label>
          <span class="sr-only">Minutes</span>
          <input type="text" inputmode="numeric" autocomplete="off" maxlength="4" [value]="mins()" [attr.aria-invalid]="!valid()" (input)="typed('m', $event)" (focus)="selectAll($event)" (change)="settle()" (keydown.enter)="enter($event)" />
          <span aria-hidden="true">min</span>
        </label>
      </span>
    </app-stepper>
    <div class="chips" role="group" aria-label="Add time">
      @for (chip of chips; track chip.label) {
        <button type="button" (click)="add(chip.minutes)">{{ chip.label }}</button>
      }
      @if (showReset()) {
        <button type="button" class="reset" (click)="goTo(reset() ?? 0)">Reset</button>
      }
    </div>
    @if (note(); as message) {
      <p class="note" role="alert">{{ message }}</p>
    }
  `,
  styleUrl: './cook-duration.component.scss'
})
export class CookDurationComponent implements OnInit {
  /** The chosen time in minutes. It holds the last valid time while the boxes hold something that is not one. */
  readonly minutes = model(5);
  /** False while the boxes cannot be read as a time, so the parent's Start is switched off. */
  readonly valid = model(true);
  /** The recipe's own time in minutes, for Reset, or null when there is none. */
  readonly reset = input<number | null>(null);
  readonly submitted = output<void>();

  protected readonly min = MIN_MINUTES;
  protected readonly max = MAX_MINUTES;
  protected readonly chips = [
    { label: '+1 min', minutes: 1 },
    { label: '+5 min', minutes: 5 },
    { label: '+15 min', minutes: 15 },
    { label: '+1 h', minutes: 60 }
  ];
  protected readonly hours = signal('0');
  protected readonly mins = signal('5');
  protected readonly note = signal('');

  ngOnInit(): void {
    this.show(this.minutes());
  }

  protected showReset(): boolean {
    const reset = this.reset();
    return reset !== null && reset !== this.minutes();
  }

  protected typed(which: 'h' | 'm', event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    const hours = which === 'h' ? text : this.hours();
    const mins = which === 'm' ? text : this.mins();
    (which === 'h' ? this.hours : this.mins).set(text);
    const parsed = parseDuration(hours, mins);
    this.note.set(parsed.note);
    this.valid.set(parsed.minutes !== null);
    if (parsed.minutes !== null) {
      this.minutes.set(parsed.minutes);
    }
  }

  /** On leaving a box: minutes over 59 roll into hours and blank boxes show 0. */
  protected settle(): void {
    if (this.valid()) {
      this.show(this.minutes());
    }
  }

  protected enter(event: Event): void {
    event.preventDefault();
    this.settle();
    if (this.valid()) {
      this.submitted.emit();
    }
  }

  protected selectAll(event: Event): void {
    (event.target as HTMLInputElement).select();
  }

  protected add(by: number): void {
    this.goTo(addMinutes(this.valid() ? this.minutes() : 0, by));
  }

  protected nudged(direction: 1 | -1): void {
    this.goTo(nudge(this.valid() ? this.minutes() : MIN_MINUTES, direction));
  }

  protected goTo(total: number): void {
    this.minutes.set(total);
    this.show(total);
  }

  private show(total: number): void {
    const { hours, minutes } = splitMinutes(total);
    this.hours.set(String(hours));
    this.mins.set(String(minutes));
    this.note.set('');
    this.valid.set(true);
  }
}
