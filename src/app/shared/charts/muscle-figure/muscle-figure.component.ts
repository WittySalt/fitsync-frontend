import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { BACK_VIEW, FRONT_VIEW, FigureRegion, FigureView } from './muscle-figure.paths';
import { HeatLevel, formatSets, groupLabel, heatLevel, regionAriaLabel } from './muscle-figure';

interface DrawnRegion extends FigureRegion {
  level: HeatLevel;
  aria: string;
  title: string;
}

interface DrawnView {
  name: 'Front' | 'Back';
  view: FigureView;
  regions: DrawnRegion[];
}

/**
 * The anatomical figure, front and back, drawn in house. Sixteen regions, each its own path and
 * each coloured by the catalogue group it belongs to, so a finer muscle shows its group's hard
 * sets a week. A region is a button: pressing it picks its group, pressing a region of the picked
 * group lets go. While a group is picked its regions get a dark outline and the rest fade.
 */
@Component({
  selector: 'app-muscle-figure',
  templateUrl: './muscle-figure.component.html',
  styleUrl: './muscle-figure.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MuscleFigureComponent {
  /** Hard sets a week by group code (CHEST, BACK, ...). A missing group counts as none. */
  readonly setsByGroup = input<Readonly<Record<string, number>>>({});
  readonly selected = input<string | null>(null);
  /** The height of each view in pixels; the board draws it at 220, and never under 140. */
  readonly height = input(220);
  /**
   * False draws the figure as a picture only, as on the Progress card, where the card is the link: no
   * buttons, no tap handlers, nothing to focus, and its labels hidden from a screen reader.
   */
  readonly interactive = input(true);

  readonly groupSelected = output<string>();

  // The width keeps the 100 by 220 viewBox's aspect ratio.
  protected readonly width = computed(() => Math.round((Math.max(140, this.height()) * 100) / 220));
  protected readonly drawHeight = computed(() => Math.max(140, this.height()));

  protected readonly views = computed<DrawnView[]>(() => {
    const sets = this.setsByGroup() ?? {};
    const draw = (region: FigureRegion): DrawnRegion => {
      const value = Number(sets[region.group] ?? 0);
      return {
        ...region,
        level: heatLevel(value),
        aria: regionAriaLabel(region.group, value),
        title: `${region.label}, coloured as ${groupLabel(region.group)}, ${formatSets(value)} hard sets a week`
      };
    };
    return [
      { name: 'Front', view: FRONT_VIEW, regions: FRONT_VIEW.regions.map(draw) },
      { name: 'Back', view: BACK_VIEW, regions: BACK_VIEW.regions.map(draw) }
    ];
  });

  protected press(group: string, event?: Event): void {
    if (!this.interactive()) {
      return;
    }
    event?.preventDefault();
    this.groupSelected.emit(group);
  }
}
