import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, finalize, map, of, switchMap } from 'rxjs';

import { ActionResult } from './admin-action';
import { AdminActionStatusComponent } from './admin-action-status.component';
import { AdminApiService, EMAIL_KINDS, EmailKind, EmailKindAvailability, EmailSendOutcome } from './admin-api.service';

type AvailabilityState =
  | { kind: 'loading' }
  | { kind: 'ready'; rows: EmailKindAvailability[] }
  | { kind: 'no-record' }
  | { kind: 'failed' };

export const EMAIL_KIND_LABELS: Record<EmailKind, string> = {
  TRAINING_REMINDER: 'Training reminder',
  GOAL_REACHED: 'Goal reached',
  WEEKLY_REPORT: 'Weekly report'
};

export const EMAIL_OUTCOME_MESSAGES: Record<EmailSendOutcome, string> = {
  SENT: 'Sent.',
  RETRYING: 'SES refused it; it will retry within minutes.',
  DROPPED: "Not sent: the user's settings changed."
};

export const NO_RECORD_MESSAGE = 'This user has no notification record yet.';

/** The words for a refused send: the sentence the service gave, or a plain line for the status. */
export function sendErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Nothing was sent. Try again.';
  }
  const body = (error.error ?? null) as { message?: unknown } | null;
  if (typeof body?.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }
  switch (error.status) {
    case 0:
      return 'FitSync could not be reached. Nothing was sent.';
    case 403:
      return 'This action is for administrators.';
    case 404:
      return NO_RECORD_MESSAGE;
    case 409:
      return 'This email cannot be sent to this user now.';
    case 429:
      return 'You have sent the most emails allowed this hour. Try again later.';
    default:
      return 'Nothing was sent. Try again.';
  }
}

interface Row {
  kind: EmailKind;
  label: string;
  available: boolean;
  /** The reason shown beside a button that cannot be pressed, or null. */
  reason: string | null;
}

/**
 * Sends one notification email to a user now. It knows the user only by id and never shows or asks for
 * their address. Which emails can be sent is loaded when it opens and again after every send.
 */
@Component({
  selector: 'app-admin-send-email',
  imports: [AdminActionStatusComponent],
  template: `
    @if (noRecord()) {
      <p class="notice">{{ noRecordMessage }}</p>
    } @else if (failed()) {
      <div class="notice-row">
        <p class="notice">The emails that can be sent could not be loaded.</p>
        <button class="retry" type="button" (click)="load()">Try again</button>
      </div>
    }
    <ul class="send-list" [attr.aria-busy]="loading()">
      @for (row of rows(); track row.kind) {
        <li class="send-row">
          <button
            class="send"
            type="button"
            [disabled]="!row.available || sending() !== null"
            [attr.aria-busy]="sending() === row.kind"
            [attr.aria-describedby]="row.reason ? 'send-email-reason-' + row.kind : null"
            (click)="send(row.kind)"
          >{{ sending() === row.kind ? 'Sending...' : row.label }}</button>
          <div class="send-detail">
            @if (loading()) {
              <span class="skeleton" aria-hidden="true"></span>
            } @else if (row.reason) {
              <p class="reason" [id]="'send-email-reason-' + row.kind">{{ row.reason }}</p>
            }
            <app-admin-action-status [result]="results()[row.kind] ?? null" />
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    @use './admin-button' as button;

    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }

    .send-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .send-row {
      display: grid;
      grid-template-columns: 200px minmax(0, 1fr);
      align-items: start;
      gap: 12px 16px;
    }

    .send-detail {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      min-height: 44px;
      justify-content: center;
    }

    .send,
    .retry {
      @include button.outline-button;
    }

    .retry {
      flex: none;
    }

    .reason,
    .notice {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: var(--text-secondary);
      overflow-wrap: anywhere;
    }

    .notice {
      color: var(--text-primary);
    }

    .notice-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px 16px;
    }

    .skeleton {
      display: block;
      width: 60%;
      height: 14px;
      border-radius: var(--radius-sm, 4px);
      background: var(--surface-sunken);
      animation: send-email-pulse 1.4s ease-in-out infinite;
    }

    @keyframes send-email-pulse {
      50% {
        opacity: 0.55;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }

    @media (max-width: 640px) {
      .send-row {
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
      }

      .send {
        width: 100%;
      }

      .send-detail {
        min-height: 0;
      }
    }
  `
})
export class AdminSendEmailComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly load$ = new Subject<void>();

  readonly userId = input.required<string>();

  protected readonly noRecordMessage = NO_RECORD_MESSAGE;
  protected readonly availability = signal<AvailabilityState>({ kind: 'loading' });
  protected readonly sending = signal<EmailKind | null>(null);
  protected readonly results = signal<Partial<Record<EmailKind, ActionResult>>>({});

  protected readonly loading = computed(() => this.availability().kind === 'loading');
  protected readonly noRecord = computed(() => this.availability().kind === 'no-record');
  protected readonly failed = computed(() => this.availability().kind === 'failed');

  protected readonly rows = computed<Row[]>(() => {
    const state = this.availability();
    return EMAIL_KINDS.map((kind) => {
      const row = state.kind === 'ready' ? state.rows.find((candidate) => candidate.kind === kind) : undefined;
      const available = row?.available === true;
      return {
        kind,
        label: EMAIL_KIND_LABELS[kind],
        available,
        reason: state.kind === 'ready' && !available ? (row?.message ?? 'This email cannot be sent now.') : null
      };
    });
  });

  constructor() {
    this.load$
      .pipe(
        switchMap(() =>
          this.api.getEmailAvailability(this.userId()).pipe(
            map((rows): AvailabilityState => ({ kind: 'ready', rows })),
            catchError((error: unknown) =>
              of<AvailabilityState>(error instanceof HttpErrorResponse && error.status === 404 ? { kind: 'no-record' } : { kind: 'failed' })
            )
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((state) => this.availability.set(state));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    // A reload after a send keeps the rows on screen until the new answer arrives.
    if (this.availability().kind !== 'ready') {
      this.availability.set({ kind: 'loading' });
    }
    this.load$.next();
  }

  protected send(kind: EmailKind): void {
    if (this.sending() !== null) {
      return;
    }
    this.sending.set(kind);
    this.setResult(kind, null);
    this.api
      .sendEmail(this.userId(), kind)
      .pipe(
        finalize(() => {
          this.sending.set(null);
          this.load();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) =>
          this.setResult(kind, { kind: result.outcome === 'SENT' ? 'success' : 'error', message: EMAIL_OUTCOME_MESSAGES[result.outcome] }),
        error: (error: unknown) => this.setResult(kind, { kind: 'error', message: sendErrorMessage(error) })
      });
  }

  private setResult(kind: EmailKind, result: ActionResult | null): void {
    this.results.update((current) => {
      const next = { ...current };
      if (result) {
        next[kind] = result;
      } else {
        delete next[kind];
      }
      return next;
    });
  }
}
