import { ApplicationRef, ComponentRef, EnvironmentInjector, Injectable, createComponent, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { GUIDE_ARRIVALS, GUIDE_PATHS, PathCopy, SURFACE_MIN_STEPS } from './guide-paths';
import { GuideService, GuideStepId, TOUR_PAGES, TourPage, isSurface } from './guide.service';
import { SpotlightComponent } from './spotlight.component';

/** Waits for the anchors of a page to arrive, since cards load their data at different moments. */
const SETTLE_MS = 300;

/** What the page tells the path about one of its anchors. */
export interface SpotlightAnchor {
  page: TourPage;
  step: string;
  element: HTMLElement;
  /** The state of the account the words depend on, such as "empty" for no plan yet. */
  variant: () => string;
}

/**
 * Runs the spotlight path of a page. Anchors register themselves (see SpotlightDirective); once they have settled the
 * path starts if the page was opened with `?guide=` or is due for a new account, then walks the steps in the order
 * the page's path lists them, skipping every step whose anchor is not on the page.
 */
@Injectable({ providedIn: 'root' })
export class SpotlightPathService {
  private readonly guide = inject(GuideService);
  private readonly router = inject(Router);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);

  private anchors: SpotlightAnchor[] = [];
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private overlay: ComponentRef<SpotlightComponent> | null = null;
  private running: { page: TourPage; index: number; step: string } | null = null;
  private scrollCancel: (() => void) | null = null;
  private readonly reposition = (): void => this.place();

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      if (event.urlAfterRedirects.startsWith('/dashboard')) {
        this.guide.stopFollowing();
      } else {
        this.guide.checkFollowed();
      }
    });
    // A path that waited for the data of its page (a plan edited, a cook record) starts once the page reports.
    this.guide.usageReported.subscribe(() => this.schedule());
  }

  /**
   * "Show me": plays the path of a surface now, whatever the once flag and the skip condition say. A path that is
   * on screen is closed first. Does nothing when no step of the surface has an anchor on the page.
   */
  replay(page: TourPage): void {
    this.guide.start();
    if (this.running) {
      this.finish();
    }
    this.guide.markReplayed(page);
    if (this.present(page).length === 0) {
      return;
    }
    this.running = { page, index: -1, step: '' };
    this.guide.pathRunning.set(true);
    this.advance();
  }

  /** Adds an anchor and returns the way to take it away again. */
  register(anchor: SpotlightAnchor): () => void {
    this.anchors.push(anchor);
    this.schedule();
    return () => {
      const wasOpen = !!this.overlay && this.running?.page === anchor.page && this.running.step === anchor.step;
      this.anchors = this.anchors.filter((candidate) => candidate !== anchor);
      if (this.running && wasOpen) {
        this.advance();
      } else if (this.running && !this.anchors.some((candidate) => candidate.page === this.running?.page)) {
        this.finish();
      }
    };
  }

  private schedule(): void {
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
    }
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.tryStart();
    }, SETTLE_MS);
  }

  /** The page named by `?guide=` in the address, when there is one. */
  private arrival(): { page: TourPage; card: GuideStepId | null } | null {
    const param = this.router.parseUrl(this.router.url).queryParams['guide'];
    const entry = typeof param === 'string' ? GUIDE_ARRIVALS[param] : undefined;
    return entry ? { page: entry.page, card: entry.card } : null;
  }

  private tryStart(): void {
    this.guide.start();
    if (this.running || !this.guide.ready()) {
      return;
    }
    const arrival = this.arrival();
    if (arrival?.card) {
      this.guide.follow(arrival.card);
    }
    let pages = TOUR_PAGES.filter((page) => this.anchors.some((anchor) => anchor.page === page && anchor.element.isConnected));
    // The coach dock covers the page, so while it is open its path is the only one that can run.
    if (pages.includes('coach-dock')) {
      pages = ['coach-dock'];
    }
    const page = pages.find((candidate) => this.startable(candidate, arrival?.page === candidate));
    if (page) {
      this.running = { page, index: -1, step: '' };
      this.guide.pathRunning.set(true);
      this.advance();
    }
  }

  /**
   * Whether the path of a page starts now: it is due, enough of its steps are on screen, and its skip condition
   * does not say the person already uses the surface. A path that must be skipped is recorded as skipped by data.
   */
  private startable(page: TourPage, explicit: boolean): boolean {
    if (!this.guide.spotlightDue(page, explicit)) {
      return false;
    }
    if (isSurface(page) && this.present(page).length < SURFACE_MIN_STEPS) {
      return false;
    }
    const gate = this.guide.gate(page);
    if (gate === 'skip') {
      this.guide.markSkippedByData(page);
    }
    return gate === 'go';
  }

  /** The steps of the running page that have an anchor on screen now, in path order. */
  private present(page: TourPage): { id: string; anchor: SpotlightAnchor }[] {
    const found: { id: string; anchor: SpotlightAnchor }[] = [];
    for (const step of GUIDE_PATHS[page]) {
      const candidates = this.anchors.filter((candidate) => candidate.page === page && candidate.step === step.id && candidate.element.isConnected);
      // A step can have two anchors when the layout swaps one for the other; the one with a box on screen wins.
      const anchor = candidates.find((candidate) => candidate.element.getClientRects().length > 0) ?? candidates[0];
      if (anchor) {
        found.push({ id: step.id, anchor });
      }
    }
    return found;
  }

  private currentAnchor(): SpotlightAnchor | null {
    const run = this.running;
    return run ? (this.present(run.page).find((entry) => entry.id === run.step)?.anchor ?? null) : null;
  }

  /** Moves to the next step with an anchor, or ends the path when there is none. */
  private advance(): void {
    const run = this.running;
    if (!run) {
      return;
    }
    this.closeOverlay();
    const order = GUIDE_PATHS[run.page].map((step) => step.id);
    const present = this.present(run.page);
    const after = run.index;
    const next = present.find((entry) => order.indexOf(entry.id) > after);
    if (!next) {
      this.finish();
      return;
    }
    run.index = order.indexOf(next.id);
    run.step = next.id;
    this.reveal(next.anchor, () => this.show());
  }

  /** Brings the anchor into view, waits for the scroll to settle, then runs `then`. */
  private reveal(anchor: SpotlightAnchor, then: () => void): void {
    const element = anchor.element;
    const r = element.getBoundingClientRect();
    const inView = r.top >= 0 && r.bottom <= window.innerHeight;
    if (inView || !element.scrollIntoView) {
      then();
      return;
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    element.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    let done = false;
    const finish = (): void => {
      if (done) {
        return;
      }
      done = true;
      this.scrollCancel = null;
      window.removeEventListener('scrollend', finish, true);
      window.clearTimeout(timer);
      if (element.isConnected && this.running) {
        // One more frame so the layout after the scroll is what gets measured.
        requestAnimationFrame(() => {
          if (this.running && !this.overlay) {
            then();
          }
        });
      }
    };
    const timer = window.setTimeout(finish, 400);
    window.addEventListener('scrollend', finish, true);
    this.scrollCancel = (): void => {
      done = true;
      window.removeEventListener('scrollend', finish, true);
      window.clearTimeout(timer);
    };
  }

  private show(): void {
    const run = this.running;
    const anchor = this.currentAnchor();
    if (!run || !anchor || this.overlay) {
      return;
    }
    const present = this.present(run.page);
    const position = present.findIndex((entry) => entry.id === run.step);
    const copy = this.copyOf(run.page, run.step, anchor);
    const overlay = createComponent(SpotlightComponent, { environmentInjector: this.injector });
    overlay.setInput('title', copy.title);
    overlay.setInput('text', copy.text);
    overlay.setInput('rect', this.measure());
    overlay.setInput('position', { n: position + 1, m: present.length });
    overlay.setInput('last', position === present.length - 1);
    overlay.instance.next.subscribe(() => this.advance());
    overlay.instance.skip.subscribe(() => {
      this.guide.skipTour();
      this.finish();
    });
    this.appRef.attachView(overlay.hostView);
    document.body.appendChild(overlay.location.nativeElement);
    this.overlay = overlay;
    window.addEventListener('resize', this.reposition);
    window.addEventListener('scroll', this.reposition, true);
    overlay.changeDetectorRef.detectChanges();
    this.place();
  }

  private copyOf(page: TourPage, stepId: string, anchor: SpotlightAnchor): PathCopy {
    const step = GUIDE_PATHS[page].find((candidate) => candidate.id === stepId);
    return step ? step.copy(anchor.variant()) : { title: '', text: '' };
  }

  private measure(): { top: number; left: number; width: number; height: number } {
    const r = this.currentAnchor()?.element.getBoundingClientRect();
    return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : { top: 0, left: 0, width: 0, height: 0 };
  }

  private place(): void {
    if (!this.overlay) {
      return;
    }
    this.overlay.setInput('rect', this.measure());
    this.overlay.setInput('viewport', { width: window.innerWidth, height: window.innerHeight });
    const pop = this.overlay.location.nativeElement.querySelector('.pop') as HTMLElement | null;
    if (pop && pop.offsetHeight > 0) {
      this.overlay.setInput('cardHeight', pop.offsetHeight);
    }
  }

  private closeOverlay(): void {
    this.scrollCancel?.();
    this.scrollCancel = null;
    const overlay = this.overlay;
    if (!overlay) {
      return;
    }
    this.overlay = null;
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition, true);
    this.appRef.detachView(overlay.hostView);
    overlay.destroy();
  }

  /** The end of a path: closing, skipping or leaving the page records the page as seen. */
  private finish(): void {
    const run = this.running;
    this.closeOverlay();
    this.running = null;
    this.guide.pathRunning.set(false);
    if (run) {
      this.guide.markSeen(run.page);
      this.guide.checkFollowed();
    }
  }
}
