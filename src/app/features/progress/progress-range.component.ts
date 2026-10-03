import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { dateRangeLabel } from '../../shared/date-label';
import { DateRange, isValidRange, RANGE_PRESETS } from './progress-range';

/**
 * The one range of the Overview tab. Three presets sit in a row with the chosen one filled, and
 * a "More" disclosure holds a custom start and end. The page owns the range; this only asks.
 */
@Component({
  selector: 'app-progress-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './progress-range.component.html',
  styleUrl: './progress-range.component.scss'
})
export class ProgressRangeComponent {
  readonly range = input.required<DateRange>();
  /** The preset in use, or null while a custom range is. */
  readonly activeDays = input<number | null>(null);
  readonly presetChosen = output<number>();
  readonly customChosen = output<DateRange>();

  readonly presets = RANGE_PRESETS;
  readonly moreOpen = signal(false);
  readonly from = signal('');
  readonly to = signal('');
  readonly invalid = computed(() => (this.from() !== '' || this.to() !== '') && !isValidRange({ from: this.from(), to: this.to() }));
  readonly caption = computed(() => dateRangeLabel(this.range().from, this.range().to));

  toggleMore(): void {
    if (!this.moreOpen()) {
      this.from.set(this.range().from);
      this.to.set(this.range().to);
    }
    this.moreOpen.update((open) => !open);
  }

  apply(): void {
    const custom = { from: this.from(), to: this.to() };
    if (isValidRange(custom)) {
      this.customChosen.emit(custom);
    }
  }
}
