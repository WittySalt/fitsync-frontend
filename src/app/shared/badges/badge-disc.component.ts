import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { BadgeNode } from '../../core/me.models';
import { NodeState, RING_RADIUS, glyphFor, ringLength } from './badge-model';

/**
 * One badge as a disc on a 64 unit grid. Earned is a filled green disc with its glyph, next is a
 * white disc with a slate progress ring, later is a hollow slate circle.
 */
@Component({
  selector: 'app-badge-disc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      @switch (state()) {
        @case ('earned') {
          <circle class="fill" cx="32" cy="32" r="30"></circle>
        }
        @case ('next') {
          <circle class="track" cx="32" cy="32" r="29"></circle>
          @if (ring().length > 0) {
            <circle
              class="arc"
              cx="32"
              cy="32"
              [attr.r]="radius"
              transform="rotate(-90 32 32)"
              [attr.stroke-dasharray]="ring().length + ' ' + ring().circumference"
            ></circle>
          }
          <circle class="inner" cx="32" cy="32" r="24.5"></circle>
        }
        @default {
          <circle class="hollow" cx="32" cy="32" r="28"></circle>
        }
      }
      @if (state() !== 'later') {
        <g class="glyph" [class.on-fill]="state() === 'earned'" transform="translate(20 20)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          @for (part of glyph(); track $index) {
            @switch (part.tag) {
              @case ('path') {
                <path [attr.d]="part.d"></path>
              }
              @case ('circle') {
                <circle [attr.cx]="part.cx" [attr.cy]="part.cy" [attr.r]="part.r"></circle>
              }
              @case ('rect') {
                <rect [attr.x]="part.x" [attr.y]="part.y" [attr.width]="part.width" [attr.height]="part.height" [attr.rx]="part.rx"></rect>
              }
            }
          }
        </g>
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; flex: none; }
    svg { display: block; }
    .fill { fill: var(--accent); }
    .track { stroke: var(--border); stroke-width: 4; fill: var(--surface); }
    .arc { stroke: var(--text-secondary); stroke-width: 4; stroke-linecap: round; fill: none; }
    .inner { fill: var(--surface); }
    .hollow { stroke: var(--border-strong); stroke-width: 2; fill: var(--surface); }
    .glyph { stroke: var(--text-secondary); fill: none; }
    .glyph.on-fill { stroke: var(--text-on-accent); }
  `
})
export class BadgeDiscComponent {
  readonly node = input.required<BadgeNode>();
  readonly state = input.required<NodeState>();
  readonly size = input(40);

  protected readonly radius = RING_RADIUS;
  protected readonly ring = computed(() => ringLength(this.node()));
  protected readonly glyph = computed(() => glyphFor(this.node().code));
}
