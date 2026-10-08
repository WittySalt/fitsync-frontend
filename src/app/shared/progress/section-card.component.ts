import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CoachStore } from '../../core/coach/coach.store';
import { ProgressCardContext } from './progress.models';

/**
 * A white section card: its title, an optional line under it, the coach's line, and an Ask button
 * that opens the coach with this card pinned. With `link` set the whole card opens that page; the
 * chevron is the keyboard's way in. With `factNumber` set the card carries the badge of the fact in
 * the coach's reading that cites it.
 */
@Component({
  selector: 'app-section-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'openFromCard($event)' },
  template: `
    <article class="card" [class.linked]="!!link()" [class.ringed]="ringed()" [class.bare]="bare()">
      <header class="head">
        <div class="titles">
          <div class="title-row">
            @if (factNumber(); as n) {
              <span class="cite" [attr.title]="'Fact ' + n + ' in the coach’s reading'">{{ n }}</span>
            }
            <h2>{{ title() }}</h2>
          </div>
          @if (factNumber(); as n) {
            <span class="fact-note">Fact {{ n }} in your coach's reading</span>
          }
          @if (sub()) {
            <span class="sub">{{ sub() }}</span>
          }
          @if (quiet()) {
            <span class="quiet">{{ quiet() }}</span>
          }
        </div>
        <div class="actions">
          @if (context()) {
            <button type="button" class="ask" (click)="askCoach($event)" [attr.aria-label]="'Ask the coach about ' + title()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4Z"></path></svg>
              Ask
            </button>
          }
          @if (link()) {
            <a class="open" [routerLink]="link()" [attr.aria-label]="'Open ' + title()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
            </a>
          }
        </div>
      </header>
      @if (coachLine()) {
        <div class="coach">
          <span class="mark" aria-hidden="true">C</span>
          <p>{{ coachLine() }}</p>
        </div>
      }
      <ng-content />
    </article>
  `,
  styles: `
    :host { display: block; min-width: 0; scroll-margin-top: 64px; }
    .card { box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; padding: 22px; border-radius: 22px; background: var(--surface); border: 1px solid var(--border); transition: box-shadow var(--dur-base) var(--ease-standard), border-color var(--dur-base); }
    .linked { cursor: pointer; }
    .linked:hover { border-color: var(--border-strong); }
    .ringed { border-color: var(--border-accent); box-shadow: 0 0 0 3px var(--accent-subtle); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .titles { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .title-row { display: flex; align-items: center; gap: 8px; }
    h2 { margin: 0; font-size: 17px; font-weight: 700; color: var(--text-primary); }
    .cite { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 6px; background: var(--accent-subtle); color: var(--accent-text); font-size: 11px; font-weight: 700; }
    .fact-note { font-size: var(--text-xs); color: var(--text-secondary); }
    .sub { font-size: 13px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .quiet { font-size: var(--text-xs); color: var(--text-secondary); }
    .bare { gap: 10px; padding: 0; border: 0; border-radius: 0; background: none; }
    .actions { display: flex; align-items: center; gap: 8px; flex: none; }
    .ask { height: 30px; padding: 0 11px; border-radius: 10px; border: 1px solid var(--accent-subtle); background: var(--surface); display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: var(--text-xs); font-weight: 700; color: var(--accent-text); cursor: pointer; }
    .ask svg { color: var(--accent); }
    .open { display: inline-flex; color: var(--text-muted); border-radius: 8px; }
    .ask:focus-visible, .open:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
    .coach { display: flex; align-items: flex-start; gap: 10px; }
    .mark { flex: none; width: 22px; height: 22px; border-radius: 8px; background: var(--accent); color: var(--text-on-accent); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .coach p { margin: 1px 0 0; font-size: var(--text-sm); line-height: 1.55; color: var(--text-primary); }
    @media (max-width: 640px) { .card:not(.bare) { padding: 18px; } }
    @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
  `
})
export class SectionCardComponent {
  private readonly router = inject(Router);
  private readonly coach = inject(CoachStore);

  readonly title = input.required<string>();
  readonly sub = input('');
  /** A second, quieter line under the sub, such as how a figure is worked out. */
  readonly quiet = input('');
  readonly coachLine = input('');
  /** The card's kind and days; with it the Ask button shows. */
  readonly context = input<ProgressCardContext | null>(null);
  /** A page the whole card opens. */
  readonly link = input<string | null>(null);
  readonly factNumber = input<number | null>(null);
  readonly ringed = input(false);
  /** No border or padding: the section is a heading over cards of its own. */
  readonly bare = input(false);

  /** Emitted with the card context when Ask is pressed, after the coach has been opened with it. */
  readonly ask = output<ProgressCardContext>();

  askCoach(event: Event): void {
    event.stopPropagation();
    const context = this.context();
    if (!context) {
      return;
    }
    this.coach.askAboutCard(context);
    this.ask.emit(context);
  }

  /** A click anywhere on a linked card opens its page, unless it landed on a control inside it. */
  openFromCard(event: MouseEvent): void {
    const link = this.link();
    const target = event.target as HTMLElement | null;
    if (!link || target?.closest('a, button, input, select, textarea, label, summary')) {
      return;
    }
    void this.router.navigateByUrl(link);
  }
}
