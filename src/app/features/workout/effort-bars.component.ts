import { Component, computed, model } from '@angular/core';

/** The word for each effort from 1 to 10, as the completion screen and the session page say it. */
export function effortWord(value: number | null | undefined): string {
  if (!value || value < 1) {
    return '';
  }
  if (value <= 2) {
    return 'Very easy';
  }
  if (value <= 4) {
    return 'Easy';
  }
  if (value <= 6) {
    return 'Moderate';
  }
  if (value <= 8) {
    return 'Hard';
  }
  return value === 9 ? 'Very hard' : 'All out';
}

/**
 * How hard a workout was, as ten bars that rise from easy to all out. The bars up to the value are
 * filled: pale green while the value is the server's estimate, full green once the person chose it.
 * The bars are one radio group, so the arrow keys move the value as they do for any radio group.
 */
@Component({
  selector: 'app-effort-bars',
  template: `
    <div class="head">
      <strong class="figure">{{ value() }}</strong>
      <span class="word">{{ word() }}</span>
      <span class="tag" [class.own]="!estimated()">{{ estimated() ? 'Estimated' : 'Yours' }}</span>
    </div>
    <div class="bars" role="radiogroup" aria-label="How hard was it">
      @for (step of steps; track step) {
        <button
          type="button"
          role="radio"
          class="bar"
          [attr.aria-checked]="step === value()"
          [attr.aria-label]="step + ', ' + wordOf(step)"
          [tabindex]="step === value() ? 0 : -1"
          (click)="choose(step)"
          (keydown)="onKey($event)"
        >
          <span class="fill" [class.on]="step <= value()" [class.estimate]="estimated()" [style.height.px]="14 + step * 5"></span>
        </button>
      }
    </div>
    <div class="ends" aria-hidden="true"><span>Easy</span><span>All out</span></div>
  `,
  styleUrl: './effort-bars.component.scss'
})
export class EffortBarsComponent {
  /** The effort shown, from 1 to 10. */
  readonly value = model(5);
  /** True while the value is the server's estimate; a choice makes it the person's own. */
  readonly estimated = model(true);

  protected readonly steps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  protected readonly word = computed(() => effortWord(this.value()));

  protected wordOf(step: number): string {
    return effortWord(step);
  }

  protected choose(step: number): void {
    this.value.set(step);
    this.estimated.set(false);
  }

  protected onKey(event: KeyboardEvent): void {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 0;
    if (!delta) {
      return;
    }
    event.preventDefault();
    const next = Math.min(10, Math.max(1, this.value() + delta));
    this.choose(next);
    const group = (event.currentTarget as HTMLElement | null)?.parentElement;
    group?.querySelectorAll<HTMLButtonElement>('button')[next - 1]?.focus();
  }
}
