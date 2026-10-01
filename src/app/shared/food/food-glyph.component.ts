import { Component, computed, input } from '@angular/core';

import { GLYPHS, GlyphShape } from './food-glyphs';

/** One stroke icon from the Diary set, drawn in the colour of the text around it. */
@Component({
  selector: 'app-food-glyph',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (shape of shapes(); track $index) {
        @if (isPath(shape)) {
          <path [attr.d]="shape.d"></path>
        } @else {
          <circle [attr.cx]="shape.cx" [attr.cy]="shape.cy" [attr.r]="shape.r"></circle>
        }
      }
    </svg>
  `,
  styles: [':host { display: inline-flex; flex: none; } svg { display: block; }']
})
export class FoodGlyphComponent {
  readonly name = input.required<string>();
  readonly size = input(20);
  readonly strokeWidth = input(1.9);

  protected readonly shapes = computed<readonly GlyphShape[]>(() => GLYPHS[this.name()] ?? []);

  protected isPath(shape: GlyphShape): shape is { d: string } {
    return 'd' in shape;
  }
}
