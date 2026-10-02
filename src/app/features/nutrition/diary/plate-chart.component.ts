import { Component, computed, input } from '@angular/core';

import { GLYPHS, GlyphShape } from '../../../shared/food/food-glyphs';
import { foodGroupInfo } from '../../../shared/food/food-groups';
import { PlateWedge } from './diary-plate';

const ICON_SIZE = 22;

interface WedgeView {
  group: string;
  path: string | null;
  colour: string;
  showIcon: boolean;
  transform: string;
  shapes: readonly GlyphShape[];
}

/**
 * A drawn plate with a fork and a knife. The food is its wedges by weight, with a white icon in
 * every wedge wide enough for one, and the balanced plate is dashed over it: half fruit and veg on
 * the right, protein bottom left, grains top left.
 */
@Component({
  selector: 'app-plate-chart',
  template: `
    <svg class="cutlery" width="22" [attr.height]="size() * 0.8" [attr.viewBox]="'0 0 22 ' + size() * 0.8" aria-hidden="true">
      <g fill="none" stroke-width="2.2" stroke-linecap="round">
        <path [attr.d]="'M5 ' + size() * 0.144 + 'v' + size() * 0.16"></path>
        <path [attr.d]="'M11 ' + size() * 0.144 + 'v' + size() * 0.16"></path>
        <path [attr.d]="'M17 ' + size() * 0.144 + 'v' + size() * 0.16"></path>
        <path [attr.d]="'M5 ' + size() * 0.304 + 'c0 4 12 4 12 0'"></path>
        <path [attr.d]="'M11 ' + size() * 0.344 + 'V' + size() * 0.688"></path>
      </g>
    </svg>
    <svg class="plate" [attr.width]="size()" [attr.height]="size() + 4" [attr.viewBox]="'0 0 ' + size() + ' ' + (size() + 4)" role="img" [attr.aria-label]="label()">
      <circle class="shadow" [attr.cx]="centre()" [attr.cy]="centre() + 3" [attr.r]="centre() - 4"></circle>
      <circle class="rim" [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="centre() - 4"></circle>
      <circle class="dish" [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="centre() * 0.8"></circle>
      @for (wedge of wedges(); track wedge.group) {
        @if (wedge.path) {
          <path class="wedge" [attr.d]="wedge.path" [style.fill]="wedge.colour"></path>
        } @else {
          <circle class="wedge" [attr.cx]="centre()" [attr.cy]="centre()" [attr.r]="centre() * 0.74" [style.fill]="wedge.colour"></circle>
        }
      }
      @for (wedge of wedges(); track wedge.group) {
        @if (wedge.showIcon) {
          <g class="icon" [attr.transform]="wedge.transform" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            @for (shape of wedge.shapes; track $index) {
              @if (isPath(shape)) {
                <path [attr.d]="shape.d"></path>
              } @else {
                <circle [attr.cx]="shape.cx" [attr.cy]="shape.cy" [attr.r]="shape.r"></circle>
              }
            }
          </g>
        }
      }
      <g class="balanced" fill="none" stroke-width="1.6" stroke-dasharray="4 4" stroke-linecap="round">
        <line [attr.x1]="centre()" y1="10" [attr.x2]="centre()" [attr.y2]="size() - 10"></line>
        <line x1="10" [attr.y1]="centre()" [attr.x2]="centre()" [attr.y2]="centre()"></line>
      </g>
    </svg>
    <svg class="cutlery" width="22" [attr.height]="size() * 0.8" [attr.viewBox]="'0 0 22 ' + size() * 0.8" aria-hidden="true">
      <g fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path [attr.d]="'M11 ' + size() * 0.688 + 'V' + size() * 0.416"></path>
        <path [attr.d]="'M11 ' + size() * 0.416 + 'c-3.5 0-4-6-4-12 0-6 2-' + size() * 0.096 + ' 6-' + size() * 0.096 + 'V' + size() * 0.416 + 'Z'"></path>
      </g>
    </svg>
  `,
  styles: [
    `
      :host {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }

      svg {
        flex: none;
        display: block;
      }

      .cutlery {
        stroke: var(--border-strong);
      }

      .shadow {
        fill: rgba(15, 23, 42, 0.07);
      }

      .rim {
        fill: var(--surface);
        stroke: var(--border);
        stroke-width: 1.5;
      }

      .dish {
        fill: var(--surface-sunken);
        stroke: var(--border);
        stroke-width: 1.5;
      }

      .wedge {
        stroke: var(--surface-sunken);
        stroke-width: 3;
        stroke-linejoin: round;
      }

      .balanced {
        stroke: var(--text-primary);
        opacity: 0.55;
      }
    `
  ]
})
export class PlateChartComponent {
  readonly wedges = input.required<PlateWedgeInput[]>();
  readonly size = input(216);
  readonly label = input("The day's food by group, drawn as a plate");

  protected readonly centre = computed(() => this.size() / 2);

  protected isPath(shape: GlyphShape): shape is { d: string } {
    return 'd' in shape;
  }
}

/** A wedge as the chart draws it: the geometry from the plate calculation plus the drawing details. */
export type PlateWedgeInput = WedgeView;

/** Turns calculated wedges into what the chart draws. */
export function toWedgeViews(wedges: readonly PlateWedge[]): WedgeView[] {
  return wedges.map((wedge) => {
    const info = foodGroupInfo(wedge.group);
    return {
      group: wedge.group,
      path: wedge.path,
      colour: info?.colour ?? 'var(--text-secondary)',
      showIcon: wedge.showIcon,
      transform: `translate(${wedge.iconX - ICON_SIZE / 2} ${wedge.iconY - ICON_SIZE / 2}) scale(${ICON_SIZE / 24})`,
      shapes: GLYPHS[info?.icon ?? ''] ?? []
    };
  });
}
