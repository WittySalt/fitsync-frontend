import { Component, input, output, signal } from '@angular/core';

import { FoodGlyphComponent } from '../../../shared/food/food-glyph.component';
import { unlockSound } from './cook-alert-sound';
import { CUSTOM_MAX_MINUTES, CUSTOM_NAME_MAX } from './cook-session.service';
import { TimerPhase } from './cook-timer';

/** One timer the cook added, ready to draw. */
export interface CustomTimerView {
  id: number;
  name: string;
  clock: string;
  phase: TimerPhase;
}

export interface NewTimer {
  name: string;
  minutes: number;
}

const DEFAULT_MINUTES = 5;

/**
 * The timers the cook added to this step, and "+ Add a timer" with a minutes stepper, an optional
 * name and Start. The recipe's own timer stays where it is; any number of these can sit beside it.
 */
@Component({
  selector: 'app-cook-custom-timers',
  imports: [FoodGlyphComponent],
  template: `
    @for (item of items(); track item.id) {
      <div class="item" [class.done]="item.phase === 'done'" role="group" [attr.aria-label]="label(item)">
        @if (item.phase === 'done') {
          <span class="tick"><app-food-glyph name="CHECK" [size]="16" [strokeWidth]="3" /></span>
          <strong class="name">{{ label(item) }} is done</strong>
          <button type="button" class="link" (click)="removed.emit(item.id)">Done</button>
        } @else {
          <app-food-glyph name="CLOCK" [size]="18" />
          <span class="name">{{ label(item) }}</span>
          <strong class="time" [class.dim]="item.phase === 'paused'">{{ item.clock }}</strong>
          <button type="button" class="link" (click)="minuteAdded.emit(item.id)">+1 min</button>
          <button type="button" class="link" (click)="item.phase === 'paused' ? resumed.emit(item.id) : paused.emit(item.id)">
            {{ item.phase === 'paused' ? 'Resume' : 'Pause' }}
          </button>
          <button type="button" class="drop" [attr.aria-label]="'Remove ' + label(item)" (click)="removed.emit(item.id)">
            <app-food-glyph name="CLOSE" [size]="14" [strokeWidth]="2.4" />
          </button>
        }
      </div>
    }
    @if (!open()) {
      <button type="button" class="add" (click)="open.set(true)">
        <app-food-glyph name="PLUS" [size]="14" [strokeWidth]="2.6" />Add a timer
      </button>
    } @else {
      <form class="form" (submit)="submit($event)">
        <span class="stepper">
          <button type="button" class="round" aria-label="Fewer minutes" [disabled]="minutes() <= 1" (click)="minutes.set(minutes() - 1)">
            <app-food-glyph name="MINUS" [size]="16" [strokeWidth]="2.6" />
          </button>
          <strong class="value" aria-live="polite">{{ minutes() }} min</strong>
          <button type="button" class="round" aria-label="More minutes" [disabled]="minutes() >= maxMinutes" (click)="minutes.set(minutes() + 1)">
            <app-food-glyph name="PLUS" [size]="16" [strokeWidth]="2.6" />
          </button>
        </span>
        <label class="field">
          <span class="sr-only">Name of the timer</span>
          <input type="text" name="timer-name" placeholder="Name, such as Oven preheating" autocomplete="off" [attr.maxlength]="nameMax" [value]="name()" (input)="name.set($any($event.target).value)" />
        </label>
        <span class="buttons">
          <button type="submit" class="start">Start</button>
          <button type="button" class="link" (click)="close()">Cancel</button>
        </span>
      </form>
    }
  `,
  styleUrl: './cook-custom-timers.component.scss'
})
export class CookCustomTimersComponent {
  readonly items = input<CustomTimerView[]>([]);
  readonly added = output<NewTimer>();
  readonly paused = output<number>();
  readonly resumed = output<number>();
  readonly minuteAdded = output<number>();
  readonly removed = output<number>();

  protected readonly nameMax = CUSTOM_NAME_MAX;
  protected readonly maxMinutes = CUSTOM_MAX_MINUTES;
  protected readonly open = signal(false);
  protected readonly minutes = signal(DEFAULT_MINUTES);
  protected readonly name = signal('');

  protected label(item: CustomTimerView): string {
    return item.name || 'Timer';
  }

  protected submit(event: Event): void {
    event.preventDefault();
    unlockSound();
    this.added.emit({ name: this.name().trim(), minutes: this.minutes() });
    this.close();
  }

  protected close(): void {
    this.open.set(false);
    this.minutes.set(DEFAULT_MINUTES);
    this.name.set('');
  }
}
