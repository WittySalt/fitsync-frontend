import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** The shared page for areas that are not built yet ("soon") and for addresses that do not exist ("missing"). */
@Component({
  selector: 'app-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="wrap">
      @if (missing) {
        <svg width="240" height="173" viewBox="0 0 220 158" aria-hidden="true">
          <rect x="6" y="10" width="208" height="138" rx="22" class="panel" />
          <path d="M20 52h180M20 92h180M66 18v124M136 18v124" class="grid" />
          <path d="M34 128 C 60 128, 62 96, 88 96 S 116 64, 136 64" class="route" />
          <path d="M136 64 C 156 64, 160 40, 178 40" class="route dashed" />
          <circle cx="34" cy="128" r="8" class="start" />
          <path d="M178 14c-10 0-18 8-18 18 0 13 18 30 18 30s18-17 18-30c0-10-8-18-18-18Z" class="pin" />
          <text x="178" y="38" text-anchor="middle" class="mark">?</text>
        </svg>
      } @else {
        <svg width="240" height="173" viewBox="0 0 220 158" aria-hidden="true">
          <rect x="6" y="10" width="208" height="138" rx="22" class="panel" />
          <circle cx="110" cy="80" r="52" class="ring" />
          <circle cx="110" cy="80" r="52" class="ring open" stroke-dasharray="218 327" transform="rotate(-90 110 80)" />
          <path d="M88 104h44l-5 22h-34Z" class="pot" />
          <rect x="84" y="98" width="52" height="9" rx="4" class="rim" />
          <path d="M110 98V70" class="stem" />
          <path d="M110 80c-14 0-22-8-22-20 12 0 22 6 22 20Z" class="leaf" />
          <path d="M110 72c0-14 9-22 22-22 0 13-8 22-22 22Z" class="leaf dark" />
        </svg>
      }
      <span class="eyebrow">{{ missing ? 'Page not found' : 'Coming soon' }}</span>
      <h1 #title tabindex="-1">{{ missing ? 'This page is off the map.' : heading }}</h1>
      <p>{{ missing ? 'The link may be old or mistyped. Nothing you logged is lost.' : line }}</p>
      @if (missing) {
        <code class="path">{{ path() }}</code>
      }
      <div class="actions">
        <button type="button" class="home" (click)="goHome()">Back to Home</button>
        @if (canGoBack) {
          <button type="button" class="back" (click)="goBack()">Go back</button>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; }
    .wrap { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); max-width: 440px; margin: var(--space-10) auto; text-align: center; }
    svg { display: block; max-width: 100%; height: auto; }
    .panel { fill: var(--surface-tint); stroke: var(--border-accent); stroke-opacity: .35; }
    .grid { stroke: var(--accent-subtle); stroke-width: 6; fill: none; }
    .route { fill: none; stroke: var(--accent); stroke-width: 5; stroke-linecap: round; }
    .dashed { stroke-dasharray: 2 10; }
    .start { fill: var(--surface); stroke: var(--accent); stroke-width: 4; }
    .pin { fill: var(--accent-text); }
    .mark { fill: var(--surface); font: 600 18px var(--font-display); }
    .ring { fill: none; stroke: var(--accent-subtle); stroke-width: 8; }
    .open { stroke: var(--accent); stroke-linecap: round; }
    .pot { fill: #c09272; }
    .rim { fill: #a47551; }
    .stem { stroke: var(--accent-text); stroke-width: 4; stroke-linecap: round; fill: none; }
    .leaf { fill: var(--green-500); }
    .dark { fill: var(--accent); }
    .eyebrow { font-size: var(--text-xs); font-weight: var(--fw-bold); letter-spacing: .08em; text-transform: uppercase; color: var(--accent-text); }
    h1 { margin: 0; font-size: var(--text-3xl); font-weight: var(--fw-semibold); line-height: 1.2; text-wrap: balance; outline: none; }
    p { margin: 0; font-size: var(--text-base); line-height: 1.55; color: var(--text-secondary); }
    .path { font: var(--text-xs) ui-monospace, Consolas, monospace; color: var(--text-secondary); background: var(--surface-sunken); border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-1) var(--space-2); overflow-wrap: anywhere; }
    .actions { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
    button { height: 46px; padding: 0 var(--space-5); border: 0; border-radius: var(--radius-lg); font: inherit; font-size: var(--text-sm); font-weight: var(--fw-bold); cursor: pointer; }
    .home { background: var(--accent); color: var(--text-on-accent); }
    .home:hover { background: var(--accent-hover); }
    .back { background: transparent; color: var(--accent-text); }
    button:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 2px; }
    @media (max-width: 640px) {
      .wrap { margin: var(--space-6) auto; padding: 0 var(--space-4); }
      h1 { font-size: var(--text-2xl); }
      .actions, button { align-self: stretch; width: 100%; }
    }
  `
})
export class PlaceholderPage {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly data = inject(ActivatedRoute).snapshot.data;
  private readonly titleRef = viewChild<ElementRef<HTMLElement>>('title');

  protected readonly missing = this.data['placeholder'] === 'missing';
  protected readonly heading = String(this.data['heading'] ?? 'This area is on its way.');
  protected readonly line = String(this.data['line'] ?? 'It is not ready yet.');
  protected readonly canGoBack = typeof history !== 'undefined' && history.length > 1;
  protected readonly path = signal(PlaceholderPage.pathOf(this.router.url));

  constructor() {
    this.logMissing();
    afterNextRender(() => this.titleRef()?.nativeElement.focus());
    // The same page is reused when one unknown address is followed by another.
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      const next = PlaceholderPage.pathOf(this.router.url);
      if (next !== this.path()) {
        this.path.set(next);
        this.logMissing();
      }
      this.titleRef()?.nativeElement.focus();
    });
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/dashboard');
  }

  protected goBack(): void {
    this.location.back();
  }

  private logMissing(): void {
    if (this.missing) {
      console.warn(`Page not found: ${this.path()}`);
    }
  }

  private static pathOf(url: string): string {
    return url.split(/[?#]/)[0] || '/';
  }
}
