import { Component, HostListener, computed, input, output } from '@angular/core';

/** A rectangle in viewport pixels. */
export interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_GAP = 12;
const EDGE = 16;
const CARD_WIDTH = 320;
const CARD_HEIGHT_ESTIMATE = 170;
const PAD = 6;

/**
 * Where the pop card goes: under the cut-out, or above it when there is no room below, always fully inside the
 * viewport, with a 16 px gutter at the sides.
 */
export function placeCard(
  cut: SpotRect,
  view: { width: number; height: number },
  cardHeight = CARD_HEIGHT_ESTIMATE
): { top: number; left: number } {
  const width = Math.min(CARD_WIDTH, view.width - EDGE * 2);
  const below = cut.top + cut.height + CARD_GAP;
  const above = cut.top - CARD_GAP - cardHeight;
  const raw = below + cardHeight <= view.height - EDGE ? below : above >= EDGE ? above : below;
  const top = Math.min(Math.max(EDGE, raw), Math.max(EDGE, view.height - cardHeight - EDGE));
  const left = Math.min(Math.max(EDGE, cut.left), Math.max(EDGE, view.width - width - EDGE));
  return { top, left };
}

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

  readonly cardHeight = input<number>(CARD_HEIGHT_ESTIMATE);

  readonly gotIt = output<void>();
  readonly skip = output<void>();

  /** The cut-out: the anchor with a little air around it. */
  protected readonly cut = computed<SpotRect>(() => {
    const r = this.rect();
    return { top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
  });

  /** The card goes under the anchor, or above it when there is no room below, and stays inside the viewport. */
  protected readonly pop = computed(() => placeCard(this.cut(), this.viewport(), this.cardHeight()));

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.gotIt.emit();
  }
}
