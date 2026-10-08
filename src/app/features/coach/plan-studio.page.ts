import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CoachApiService } from '../../core/coach/coach-api.service';
import { DraftSource, SessionDraftView } from '../../core/coach/coach.models';
import { CoachStore } from '../../core/coach/coach.store';
import { SpotlightDirective } from '../../core/guide/spotlight.directive';
import { ToastService } from '../../core/toast/toast.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { DEFAULT_REJECT_REASON, PlanRejectComponent } from './plan-reject.component';

const SIDEBAR_LIMIT = 8;

/** One line of the checks list; `note` marks a rule the draft had to be corrected for. */
export interface DraftCheck {
  label: string;
  note: boolean;
}

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
  imports: [RouterLink, StatePanelComponent, PlanRejectComponent, SpotlightDirective],
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
  /** Whether the reason form for setting a draft aside is open. */
  readonly rejecting = signal(false);

  /** Newest first, and only a handful: a sidebar is for choosing, not for archaeology. */
  readonly openDrafts = computed(() => this.store.drafts().filter((d) => d.status === 'DRAFT').slice(0, SIDEBAR_LIMIT));
  readonly decidedDrafts = computed(() => this.store.drafts().filter((d) => d.status !== 'DRAFT').slice(0, SIDEBAR_LIMIT));

  ngOnInit(): void {
    this.store.loadDrafts();
    const params = this.route.snapshot.queryParamMap;
    if (params.get('coach') === 'open') {
      this.store.open();
    }
    const artifactId = params.get('draft');
    if (artifactId) {
      this.open(artifactId);
    } else if (this.store.latestDraft()) {
      this.selected.set(this.store.latestDraft());
    }
  }

  open(artifactId: string): void {
    this.rejecting.set(false);
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
        void this.router.navigate(['/workout'], { queryParams: { tab: 'history', status: 'IN_PROGRESS' } });
      },
      error: (failure: { status?: number; error?: { message?: string } }) => {
        this.accepting.set(false);
        this.error.set(failure?.error?.message ?? 'The session could not be started. The draft is still here.');
      }
    });
  }

  /** Opens the reason form, which fills in the default reason so one press of the confirm is enough. */
  startReject(): void {
    this.rejecting.set(true);
  }

  cancelReject(): void {
    this.rejecting.set(false);
  }

  /** Sets the draft aside with the reason given, or the default when it was cleared. */
  reject(draft: SessionDraftView, reason: string): void {
    // 500 matches the reason field's maxlength in PlanRejectComponent.
    const text = reason.trim().slice(0, 500) || DEFAULT_REJECT_REASON;
    this.store.rejectDraft(draft.artifactId, text).subscribe({
      next: (rejected) => {
        this.rejecting.set(false);
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

  /**
   * What to tell the user was checked.
   *
   * The findings the draft carries come first and are shown as they are. A server that sends none
   * gets only what the draft's source guarantees: every draft, whoever wrote it, was held to the
   * catalogue, retirement, equipment and injury rules. "Avoids what you trained yesterday" is
   * claimed only for model drafts, because the rule-built ones say nothing about it in the data.
   */
  checks(draft: SessionDraftView): DraftCheck[] {
    const findings = (draft.findings ?? []).filter((finding) => finding && typeof finding.label === 'string' && finding.label.trim());
    if (findings.length) {
      return findings.map((finding) => ({ label: finding.label.trim(), note: finding.passed === false }));
    }
    const items: DraftCheck[] = [
      { label: 'every exercise is a real catalogue row', note: false },
      { label: 'nothing retired from the catalogue', note: false },
      { label: 'fits the equipment on your profile', note: false },
      { label: 'avoids areas you flagged as injured', note: false }
    ];
    if (draft.source !== 'RULE_FALLBACK') {
      items.splice(3, 0, { label: 'avoids what you trained yesterday', note: false });
    }
    if (draft.source === 'MODEL_REPAIRED') {
      items.push({ label: 'corrected once: the first attempt broke a rule', note: true });
    }
    return items;
  }

  volume(sets: number, reps: number | null, seconds: number | null, rest: number): string {
    const work = reps != null ? `${sets} × ${reps}` : `${sets} × ${seconds ?? 0}s`;
    return `${work} · ${rest}s rest`;
  }
}
