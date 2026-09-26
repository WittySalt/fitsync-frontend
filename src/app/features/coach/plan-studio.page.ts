import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CoachApiService } from '../../core/coach/coach-api.service';
import { DraftSource, SessionDraftView } from '../../core/coach/coach.models';
import { CoachStore } from '../../core/coach/coach.store';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

const SIDEBAR_LIMIT = 8;

/**
 * Plan Studio: a generated session, with the validator's findings shown rather than hidden, and
 * the button that turns it into a real plan and a running session.
 *
 * This page is where the design's central claim becomes visible. The draft on screen has already
 * passed five domain rules or was built by the rule engine; the card says which, in words, because
 * a session the rules built is plainer than one the model wrote and passing one off as the other
 * would be the "stored state as live state" mistake in a new coat.
 *
 * Accepting is the demo's most important beat. It creates the plan in workout-service through its
 * own API and starts a session from it, then this page sends the user to the Workout page, where
 * the session is now real.
 */
@Component({
  selector: 'app-plan-studio-page',
  imports: [RouterLink, StatePanelComponent],
  templateUrl: './plan-studio.page.html',
  styleUrl: './plan-studio.page.scss'
})
export class PlanStudioPage implements OnInit {
  protected readonly store = inject(CoachStore);
  private readonly api = inject(CoachApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly selected = signal<SessionDraftView | null>(null);
  readonly loading = signal(false);
  readonly building = signal(false);
  readonly accepting = signal(false);
  readonly error = signal<string | null>(null);
  readonly request = signal('');

  /** Newest first, and only a handful: a sidebar is for choosing, not for archaeology. */
  readonly openDrafts = computed(() => this.store.drafts().filter((d) => d.status === 'DRAFT').slice(0, SIDEBAR_LIMIT));
  readonly decidedDrafts = computed(() => this.store.drafts().filter((d) => d.status !== 'DRAFT').slice(0, SIDEBAR_LIMIT));

  ngOnInit(): void {
    this.store.loadDrafts();
    const artifactId = this.route.snapshot.queryParamMap.get('draft');
    if (artifactId) {
      this.open(artifactId);
    } else if (this.store.latestDraft()) {
      this.selected.set(this.store.latestDraft());
    }
  }

  open(artifactId: string): void {
    const known = this.store.drafts().find((d) => d.artifactId === artifactId);
    if (known) {
      this.selected.set(known);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.getSessionDraft(artifactId).subscribe({
      next: (draft) => {
        this.selected.set(draft);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('That draft could not be found. It may belong to another account or have been removed.');
        this.loading.set(false);
      }
    });
  }

  build(): void {
    if (this.building()) {
      return;
    }
    this.building.set(true);
    this.error.set(null);
    this.api.draftSession(this.request().trim() || undefined).subscribe({
      next: (draft) => {
        this.store.drafts.update((list) => [draft, ...list.filter((d) => d.artifactId !== draft.artifactId)]);
        this.store.latestDraft.set(draft);
        this.selected.set(draft);
        this.building.set(false);
      },
      error: (failure: { status?: number; error?: { message?: string } }) => {
        this.error.set(
          failure?.status === 503
            ? (failure.error?.message ?? 'Nothing could be built from the exercises available today.')
            : 'The coach could not draft a session just now. Try again in a moment.'
        );
        this.building.set(false);
      }
    });
  }

  /**
   * Turns the draft into a real plan and session, then goes to the Workout page.
   *
   * The response says whether the session started. If the plan was saved but the session could
   * not be started, the user is told to start it from the plan rather than shown a page that has
   * nothing in progress.
   */
  accept(draft: SessionDraftView): void {
    if (this.accepting()) {
      return;
    }
    this.accepting.set(true);
    this.error.set(null);
    this.store.acceptDraft(draft.artifactId).subscribe({
      next: (accepted) => {
        this.accepting.set(false);
        this.selected.update((d) => (d ? { ...d, status: 'ACCEPTED', planId: accepted.planId, sessionId: accepted.sessionId } : d));
        if (accepted.sessionStarted) {
          this.toast.success(`Session started: ${draft.session.title}`);
        } else {
          this.toast.info('Plan saved. The session could not be started; start it from the plan.');
        }
        this.store.refreshRecommendations();
        void this.router.navigate(['/workout'], { queryParams: { tab: 'history', status: 'IN_PROGRESS' } });
      },
      error: (failure: { status?: number; error?: { message?: string } }) => {
        this.accepting.set(false);
        this.error.set(failure?.error?.message ?? 'The session could not be started. The draft is still here.');
      }
    });
  }

  reject(draft: SessionDraftView, reason?: string): void {
    this.store.rejectDraft(draft.artifactId, reason).subscribe({
      next: (rejected) => {
        this.selected.set(rejected);
        this.toast.info('Draft set aside. The coach keeps the reason.');
      },
      error: () => this.error.set('The draft could not be set aside just now.')
    });
  }

  sourceLabel(source: DraftSource): string {
    switch (source) {
      case 'MODEL':
        return 'drafted by the model, passed validation first time';
      case 'MODEL_REPAIRED':
        return 'drafted by the model, corrected once by the validator';
      case 'RULE_FALLBACK':
        return 'built by the rule engine from your catalogue';
    }
  }

  /** The checks every accepted draft has passed, phrased as the validator phrases its rules. */
  checks(draft: SessionDraftView): string[] {
    const items = [
      'every exercise is a real catalogue row',
      'nothing retired from the catalogue',
      'fits the equipment on your profile',
      'avoids what you trained yesterday',
      'avoids areas you flagged as injured'
    ];
    if (draft.source === 'MODEL_REPAIRED') {
      items.push('corrected once: the first attempt broke a rule');
    }
    return items;
  }

  volume(sets: number, reps: number | null, seconds: number | null, rest: number): string {
    const work = reps != null ? `${sets} × ${reps}` : `${sets} × ${seconds ?? 0}s`;
    return `${work} · ${rest}s rest`;
  }
}
