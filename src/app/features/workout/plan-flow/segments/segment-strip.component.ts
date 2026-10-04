import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { StripRow } from '../../segments/segment-timer';
import { hostWidth } from '../../../progress/cards/host-width';
import { MAX_LABELLED_BARS, sessionBars, stripBand } from './segment-math';

/**
 * A session's segments as proportional bars, planned against actual: the running bar is lit and
 * `elapsedSeconds` fills it. It only draws. The live timer, the completion dialog and the session
 * record use it; the plan editor has its own timeline with grips (`app-segment-timeline`).
 */
@Component({
  selector: 'app-segment-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segment-strip.component.html',
  styleUrl: './segment-strip.component.scss'
})
export class SegmentStripComponent {
  /** A session's segments with their actual times. */
  readonly rows = input<readonly StripRow[]>([]);
  /** Index of the lit bar, for a session in progress. */
  readonly current = input<number | null>(null);
  /** Seconds spent in the running bar. */
  readonly elapsedSeconds = input(0);

  private readonly width = hostWidth(700);
  protected readonly layout = computed(() => {
    const band = stripBand(this.width());
    return band !== 'narrow' && this.rows().length > MAX_LABELLED_BARS ? 'list' : band;
  });
  protected readonly bars = computed(() => sessionBars(this.rows(), this.current(), this.elapsedSeconds()));
  protected readonly summary = computed(() =>
    this.bars()
      .map((bar) => `${bar.label} ${bar.times}`)
      .join(', ')
  );
}
