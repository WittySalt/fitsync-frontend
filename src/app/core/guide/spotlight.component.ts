import { Component, HostListener, computed, input, output } from '@angular/core';

/** A rectangle in viewport pixels. */
export interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_GAP = 12;
const EDGE = 12;
const CARD_WIDTH = 320;
const CARD_HEIGHT_ESTIMATE = 170;
const PAD = 6;

/**
 * The pop card of a first-visit spotlight, with a dark scrim that has a cut-out around the anchor. The scrim
 * never blocks the page for good: a click on it, Esc and "Got it" all close the spotlight.
 */
@Component({
  selector: 'app-spotlight',
  template: `
    <div class="scrim" aria-hidden="true" (click)="gotIt.emit()"></div>
    <div
      class="cut"
      aria-hidden="true"
      [style.top.px]="cut().top"
      [style.left.px]="cut().left"
      [style.width.px]="cut().width"
      [style.height.px]="cut().height"
    ></div>
    <section class="pop" role="dialog" aria-labelledby="spotlight-title" [style.top.px]="pop().top" [style.left.px]="pop().left">
      <h2 id="spotlight-title">{{ title() }}</h2>
      <p>{{ text() }}</p>
      <div class="actions">
        <button type="button" class="primary" (click)="gotIt.emit()">Got it</button>
        <button type="button" class="quiet" (click)="skip.emit()">Skip the tour</button>
      </div>
    </section>
  `,
  styleUrl: './spotlight.component.scss'
})
export class SpotlightComponent {
  readonly title = input.required<string>();
  readonly text = input.required<string>();
  readonly rect = input.required<SpotRect>();
  readonly viewport = input<{ width: number; height: number }>({ width: window.innerWidth, height: window.innerHeight });

  readonly gotIt = output<void>();
  readonly skip = output<void>();

  /** The cut-out: the anchor with a little air around it. */
  protected readonly cut = computed<SpotRect>(() => {
    const r = this.rect();
    return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
  });

  /** The card goes under the anchor, or above it when there is no room below, and stays inside the viewport. */
  protected readonly pop = computed(() => {
    const r = this.cut();
    const view = this.viewport();
    const below = r.top + r.height + CARD_GAP;
    const top = below + CARD_HEIGHT_ESTIMATE <= view.height ? below : Math.max(EDGE, r.top - CARD_GAP - CARD_HEIGHT_ESTIMATE);
    const left = Math.min(Math.max(EDGE, r.left), Math.max(EDGE, view.width - CARD_WIDTH - EDGE));
    return { top, left };
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.gotIt.emit();
  }
}
