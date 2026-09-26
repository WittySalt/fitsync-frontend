import { Component, Input, OnInit, inject } from '@angular/core';

import { CoachStore } from '../../core/coach/coach.store';
import { Recommendation } from '../../core/coach/coach.models';
import { RecommendationCardComponent } from './recommendation-card.component';

/**
 * The passive presence: this surface's insights, inline in the page's own layout.
 *
 * Drop one into a page template and that page has the coach. It reads the same store as the dock,
 * so it costs no request of its own, and it renders only the types bound to the surface it names
 * so a nutrition page never shows a training card. "Ask about this" opens the dock with the card
 * as the subject: one tap from reading to asking.
 */
@Component({
  selector: 'app-coach-anchor',
  imports: [RecommendationCardComponent],
  template: `
    @if (cards().length) {
      <section class="anchor" aria-label="Coach insights">
        <div class="anchor-head">
          <span class="anchor-cap">Coach</span>
          <hr />
        </div>
        <div class="anchor-cards">
          @for (rec of cards(); track rec.type) {
            <app-recommendation-card [recommendation]="rec" (ask)="askAbout($event)" />
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }
      .anchor-head {
        display: flex;
        align-items: center;
        gap: 7px;
        margin: 0 0 9px;
      }
      .anchor-cap {
        font-size: var(--text-xs);
        font-weight: var(--fw-semibold);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      hr {
        flex: 1;
        border: 0;
        border-top: 1px solid var(--border);
        margin: 0;
      }
      .anchor-cards {
        display: grid;
        gap: 9px;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }
    `
  ]
})
export class CoachAnchorComponent implements OnInit {
  private readonly store = inject(CoachStore);

  /** Limit to these types; defaults to the current surface's inline types. */
  @Input() types: string[] | null = null;
  /** How many cards at most. Pages are busy; one or two is usually right. */
  @Input() limit = 2;

  ngOnInit(): void {
    if (!this.store.recommendationsLoadedAt()) {
      this.store.loadRecommendations();
    }
  }

  protected cards(): Recommendation[] {
    const allowed = this.types ? new Set(this.types) : null;
    const source = allowed
      ? this.store.recommendations().filter((r) => allowed.has(r.type))
      : this.store.inlineRecommendations();
    return source.slice(0, this.limit);
  }

  protected askAbout(recommendation: Recommendation): void {
    this.store.askAbout(recommendation);
  }
}
