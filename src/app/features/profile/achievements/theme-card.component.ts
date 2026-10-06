import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { BadgeNode, BadgeThemeGroup } from '../../../core/me.models';
import { BadgeDiscComponent } from '../../../shared/badges/badge-disc.component';
import { PATH_SLOTS, PathNode, earnedLabel, gapLine, laterLine, lineEarnedSlots, pathNodes } from '../../../shared/badges/badge-model';

export interface OpenedNode {
  node: BadgeNode;
  state: 'earned' | 'next';
  theme: string;
}

interface DrawnPath {
  nodes: (PathNode & { sub: string })[];
  /** Width of the slate line as a percentage of the path: from the first slot's centre to the last node's. */
  lineWidth: number;
  /** Width of the green part, up to the last earned node. */
  greenWidth: number;
}

const SLOT_WIDTH = 100 / PATH_SLOTS;

/**
 * One theme as a card with one or two paths. Nodes sit on a five-slot grid so they line up from
 * card to card; the line is green up to the last earned node and slate after it.
 */
@Component({
  selector: 'app-theme-card',
  imports: [BadgeDiscComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-card.component.html',
  styleUrl: './theme-card.component.scss'
})
export class ThemeCardComponent {
  readonly theme = input.required<BadgeThemeGroup>();
  readonly today = input('');
  readonly pace = input<number | null>(null);
  readonly opened = output<OpenedNode>();

  protected readonly slots = PATH_SLOTS;
  protected readonly count = computed(() => {
    const nodes = this.theme().paths.flatMap((path) => path.nodes);
    return `${nodes.filter((node) => node.earnedOn !== null).length} of ${nodes.length}`;
  });

  protected readonly paths = computed<DrawnPath[]>(() =>
    this.theme().paths.map((path) => {
      const nodes = pathNodes(path).map((entry) => ({ ...entry, sub: this.subLine(entry) }));
      const last = Math.max(nodes.length - 1, 0);
      const earned = lineEarnedSlots(nodes);
      return { nodes, lineWidth: last * SLOT_WIDTH, greenWidth: Math.max(earned, 0) * SLOT_WIDTH };
    })
  );

  private subLine(entry: PathNode): string {
    if (entry.state === 'earned') {
      return earnedLabel(entry.node);
    }
    if (entry.state === 'next') {
      return gapLine(entry.node, this.today(), this.pace()).headline;
    }
    return laterLine(entry.node);
  }

  protected open(entry: PathNode): void {
    if (entry.state !== 'later') {
      this.opened.emit({ node: entry.node, state: entry.state, theme: this.theme().code || entry.node.theme });
    }
  }

  protected aria(entry: PathNode & { sub: string }): string {
    const state = entry.state === 'earned' ? 'earned' : entry.state === 'next' ? 'next' : 'later';
    return `${entry.node.name}, ${state}${entry.sub ? `, ${entry.sub}` : ''}`;
  }
}
