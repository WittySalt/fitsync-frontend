import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import {
  AcceptSessionDraftResponse,
  CoachMessageContext,
  CoachMessageResponse,
  CoachReading,
  CoachLimit,
  CoachStreamEvent,
  CoachSurfaceCode,
  CoachThread,
  CoachThreadDetail,
  CoachThreadPage,
  CoachThreadSummary,
  DraftMetrics,
  ReadingStatus,
  ReadingSurface,
  SessionDraftView
} from './coach.models';
import { parseSseChunk } from './sse';

/**
 * The coach's HTTP client.
 *
 * Everything but the stream goes through HttpClient, so the auth interceptor attaches the bearer
 * token the same way it does for every other service. The stream cannot: EventSource cannot POST,
 * and HttpClient buffers a response body, so a progress event that arrived while the turn was
 * still running would sit unread until the turn ended, which is exactly the delay streaming exists
 * to remove. So the stream uses fetch, reads the body incrementally, and attaches the token itself.
 */
@Injectable({ providedIn: 'root' })
export class CoachApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly coachBaseUrl = '/api/v1/coach';

  /**
   * One page's reading with the facts it stands on.
   *
   * The response is tidied here so that a missing list or an unknown status cannot break the
   * panel. Errors are passed on, because the panel hides itself on a failed request and must be
   * able to tell that apart from an empty answer.
   */
  getReading(surface: ReadingSurface): Observable<CoachReading> {
    return this.http
      .get<Partial<CoachReading>>(`${this.coachBaseUrl}/readings/${surface.toLowerCase()}`)
      .pipe(map((response) => toCoachReading(surface, response)));
  }

  listThreads(): Observable<CoachThread[]> {
    return this.http.get<CoachThread[]>(`${this.coachBaseUrl}/threads`);
  }

  createThread(title?: string): Observable<CoachThread> {
    return this.http.post<CoachThread>(`${this.coachBaseUrl}/threads`, title ? { title } : {});
  }

  getThread(threadId: string): Observable<CoachThreadDetail> {
    return this.http
      .get<CoachThreadDetail>(`${this.coachBaseUrl}/threads/${threadId}`)
      .pipe(map((detail) => toThreadDetail(threadId, detail)));
  }

  /** One page of the user's earlier conversations, newest first. Archived ones are not listed. */
  listThreadPage(page: number, size: number): Observable<CoachThreadPage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<unknown>(`${this.coachBaseUrl}/threads`, { params })
      .pipe(map((body) => toThreadPage(body, page, size)));
  }

  /** Archives a conversation. The server keeps the row; the list stops showing it. */
  archiveThread(threadId: string): Observable<void> {
    return this.http.delete<void>(`${this.coachBaseUrl}/threads/${threadId}`);
  }

  /** The plain, non-streaming turn. The fallback when the stream cannot be opened. */
  sendMessage(
    threadId: string,
    message: string,
    context?: CoachMessageContext,
    clientTurnId?: string
  ): Observable<CoachMessageResponse> {
    return this.http
      .post<RawMessageResponse>(`${this.coachBaseUrl}/threads/${threadId}/messages`, messageBody(message, context, clientTurnId), {
        headers: idempotencyHeaders(clientTurnId)
      })
      .pipe(map(toMessageResponse));
  }

  /**
   * The streaming turn, as an observable of typed events ending with `answer` or `error`.
   *
   * Completes after the answer. Errors only when the connection itself fails; a turn the coach
   * could not finish arrives as an `error` event, because that is what the server sends and the
   * store treats the two differently.
   */
  streamMessage(
    threadId: string,
    message: string,
    context?: CoachMessageContext,
    clientTurnId?: string
  ): Observable<CoachStreamEvent> {
    return new Observable<CoachStreamEvent>((subscriber) => {
      const controller = new AbortController();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...idempotencyHeaders(clientTurnId)
      };
      const token = this.auth.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(`${this.coachBaseUrl}/threads/${threadId}/messages/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(messageBody(message, context, clientTurnId)),
        signal: controller.signal
      })
        .then(async (response) => {
          if (response.status === 429) {
            throw new CoachLimitError(toCoachLimit(await readJson(response)));
          }
          if (!response.ok || !response.body) {
            throw new Error(`Coach stream failed with status ${response.status}`);
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let carry = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            const parsed = parseSseChunk(decoder.decode(value, { stream: true }), carry);
            carry = parsed.carry;
            for (const frame of parsed.frames) {
              const event = toStreamEvent(frame.event, frame.data);
              if (event) {
                subscriber.next(event);
              }
            }
          }
          subscriber.complete();
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            subscriber.error(error);
          }
        });

      return () => controller.abort();
    });
  }

  draftSession(request?: string, threadId?: string): Observable<SessionDraftView> {
    const query = threadId ? `?threadId=${encodeURIComponent(threadId)}` : '';
    return this.http.post<SessionDraftView>(`${this.coachBaseUrl}/session-drafts${query}`, request ? { request } : {});
  }

  listSessionDrafts(): Observable<SessionDraftView[]> {
    return this.http.get<SessionDraftView[]>(`${this.coachBaseUrl}/session-drafts`);
  }

  getSessionDraft(artifactId: string): Observable<SessionDraftView> {
    return this.http.get<SessionDraftView>(`${this.coachBaseUrl}/session-drafts/${artifactId}`);
  }

  acceptSessionDraft(artifactId: string): Observable<AcceptSessionDraftResponse> {
    return this.http.post<AcceptSessionDraftResponse>(`${this.coachBaseUrl}/session-drafts/${artifactId}/accept`, {});
  }

  rejectSessionDraft(artifactId: string, reason?: string): Observable<SessionDraftView> {
    return this.http.post<SessionDraftView>(
      `${this.coachBaseUrl}/session-drafts/${artifactId}/reject`,
      reason ? { reason } : {}
    );
  }

  getDraftMetrics(): Observable<DraftMetrics> {
    return this.http.get<DraftMetrics>(`${this.coachBaseUrl}/session-drafts/metrics`);
  }
}

/** Maps a raw frame onto the typed union, dropping anything the contract does not name. */
export function toStreamEvent(name: string, data: string): CoachStreamEvent | null {
  switch (name) {
    case 'tool_started':
    case 'tool_finished':
    case 'thinking':
      return { name, data: JSON.parse(data) };
    case 'answer':
      return { name, data: toMessageResponse(JSON.parse(data)) };
    case 'error':
      return { name, data: stripQuotes(data) };
    default:
      return null;
  }
}

/**
 * The body the server expects: `context` and `clientTurnId` are left out entirely when there is
 * none to send. The id travels in the body as well as in the `Idempotency-Key` header, because a
 * proxy in front of the gateway may drop a header it does not know and cannot drop a body field.
 */
function messageBody(
  message: string,
  context?: CoachMessageContext,
  clientTurnId?: string
): { message: string; context?: CoachMessageContext; clientTurnId?: string } {
  return { message, ...(context ? { context } : {}), ...(clientTurnId ? { clientTurnId } : {}) };
}

function idempotencyHeaders(clientTurnId?: string): Record<string, string> {
  return clientTurnId ? { 'Idempotency-Key': clientTurnId } : {};
}

/** Raised by the stream call when the server answers 429, so the store can tell it from a broken connection. */
export class CoachLimitError extends Error {
  constructor(readonly limit: CoachLimit) {
    super(limit.message);
  }
}

const DEFAULT_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 24 * 60 * 60;

/**
 * Reads the 429 body `{code: 'COACH_LIMIT', retryAfterSeconds, message}` defensively: a missing
 * message becomes a plain sentence, and a missing or absurd wait becomes a minute.
 */
export function toCoachLimit(body: unknown): CoachLimit {
  const raw = (body && typeof body === 'object' ? body : {}) as { retryAfterSeconds?: unknown; message?: unknown };
  const seconds =
    typeof raw.retryAfterSeconds === 'number' && Number.isFinite(raw.retryAfterSeconds) ? raw.retryAfterSeconds : DEFAULT_RETRY_SECONDS;
  const message =
    typeof raw.message === 'string' && raw.message.trim()
      ? raw.message.trim()
      : 'You have reached the coach limit for now. Try again a little later.';
  return { message, retryAfterSeconds: Math.min(MAX_RETRY_SECONDS, Math.max(1, Math.ceil(seconds))) };
}

/** The limit a failed call carries, from either the stream (CoachLimitError) or HttpClient (status 429), else null. */
export function limitFromError(error: unknown): CoachLimit | null {
  if (error instanceof CoachLimitError) {
    return error.limit;
  }
  const failure = error as { status?: number; error?: unknown } | null;
  return failure?.status === 429 ? toCoachLimit(failure.error) : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const SURFACE_CODES: CoachSurfaceCode[] = ['HOME', 'WORKOUT', 'NUTRITION', 'PROGRESS', 'PROFILE'];

/** One history row, tolerant of the id and time fields going by either the thread's or the list's names. */
function toThreadSummary(raw: unknown): CoachThreadSummary | null {
  const row = raw as Record<string, unknown> | null;
  const id = row?.['threadId'] ?? row?.['id'];
  if (typeof id !== 'string' || !id) {
    return null;
  }
  const surface = String(row?.['surface'] ?? '').toUpperCase();
  const when = row?.['lastMessageAt'] ?? row?.['lastActiveAt'] ?? row?.['createdAt'];
  const title = row?.['title'];
  const turns = row?.['turnCount'];
  return {
    threadId: id,
    title: typeof title === 'string' && title.trim() ? title.trim() : null,
    surface: SURFACE_CODES.find((code) => code === surface) ?? null,
    lastMessageAt: typeof when === 'string' ? when : null,
    turnCount: typeof turns === 'number' && Number.isFinite(turns) ? turns : 0
  };
}

/**
 * A page of history from a Spring `Page` (`content`, `last`, `totalPages`), a bare array, or an
 * `items` list. When the server says nothing about more pages, a full page is taken to mean there is one.
 */
export function toThreadPage(body: unknown, page: number, size: number): CoachThreadPage {
  const obj = body as Record<string, unknown> | null;
  const rows: unknown[] = Array.isArray(body)
    ? body
    : Array.isArray(obj?.['content'])
      ? (obj['content'] as unknown[])
      : Array.isArray(obj?.['items'])
        ? (obj['items'] as unknown[])
        : [];
  const items = rows.map(toThreadSummary).filter((row): row is CoachThreadSummary => row !== null);
  let hasMore = rows.length >= size;
  if (typeof obj?.['hasMore'] === 'boolean') {
    hasMore = obj['hasMore'];
  } else if (typeof obj?.['hasNext'] === 'boolean') {
    hasMore = obj['hasNext'];
  } else if (typeof obj?.['last'] === 'boolean') {
    hasMore = !obj['last'];
  } else if (typeof obj?.['totalPages'] === 'number') {
    hasMore = page + 1 < obj['totalPages'];
  }
  return { items, page, hasMore: hasMore && rows.length > 0 };
}

/** A thread with its turns, the id filled in from the request when the body names it `id` or leaves it out. */
function toThreadDetail(threadId: string, raw: CoachThreadDetail | null): CoachThreadDetail {
  const thread = (raw?.thread ?? {}) as Partial<CoachThread> & { id?: string; lastMessageAt?: string };
  return {
    thread: {
      threadId: thread.threadId ?? thread.id ?? threadId,
      title: thread.title ?? null,
      turnCount: thread.turnCount ?? 0,
      lastActiveAt: thread.lastActiveAt ?? thread.lastMessageAt ?? '',
      createdAt: thread.createdAt ?? ''
    },
    turns: (raw?.turns ?? []).map((turn) => ({ ...turn, tools: turn.tools ?? [] }))
  };
}

/** Everything a server that predates `pinnedReadingId` still sends. */
type RawMessageResponse = Omit<CoachMessageResponse, 'pinnedReadingId'> & { pinnedReadingId?: string | null };

/** A server that predates `pinnedReadingId` never sends it; that is read as no reading was pinned. */
function toMessageResponse(raw: RawMessageResponse): CoachMessageResponse {
  return { ...raw, pinnedReadingId: raw.pinnedReadingId ?? null };
}

/** The server sends the error message as a JSON string literal; the store wants the text. */
function stripQuotes(data: string): string {
  try {
    const parsed: unknown = JSON.parse(data);
    return typeof parsed === 'string' ? parsed : data;
  } catch {
    return data;
  }
}

const READING_STATUSES: ReadingStatus[] = ['READY', 'WRITING', 'RESTING', 'EMPTY'];

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A fact's card is kept only when it names one of the three Progress cards. */
function isCitedCard(card: unknown): card is 'GOAL' | 'TRAINING' | 'FOOD' {
  return card === 'GOAL' || card === 'TRAINING' || card === 'FOOD';
}

export function toCoachReading(surface: ReadingSurface, response: Partial<CoachReading> | null | undefined): CoachReading {
  const status = READING_STATUSES.find((candidate) => candidate === response?.status) ?? 'EMPTY';
  const text = response?.reading;
  const hasText = Boolean(
    text && typeof text.headline === 'string' && text.headline.trim() && typeof text.body === 'string' && text.body.trim()
  );

  return {
    surface,
    // A READY answer without its text cannot be shown as a reading, so it is shown as facts only.
    status: status === 'READY' && !hasText ? 'RESTING' : status,
    readingId: response?.readingId ?? null,
    period: response?.period ?? 'NONE',
    periodStart: response?.periodStart ?? null,
    periodEnd: response?.periodEnd ?? null,
    facts: (response?.facts ?? [])
      .filter((fact) => Boolean(fact) && Number.isInteger(fact.number) && typeof fact.value === 'string')
      .map((fact) => ({
        number: fact.number,
        key: fact.key ?? '',
        label: fact.label ?? '',
        value: fact.value,
        unit: fact.unit ?? '',
        numericValue: finiteOrNull(fact.numericValue),
        note: fact.note ?? '',
        detail: fact.detail ?? '',
        ...(isCitedCard(fact.card) ? { card: fact.card } : {})
      })),
    reading:
      hasText && text
        ? {
            headline: text.headline.trim(),
            body: text.body.trim(),
            citations: (text.citations ?? []).filter((citation) => Number.isInteger(citation)),
            source: text.source ?? 'MODEL',
            generatedAt: text.generatedAt ?? null
          }
        : null,
    lifts: (response?.lifts ?? [])
      .filter((lift) => Boolean(lift) && typeof lift.exerciseName === 'string')
      .map((lift) => ({
        exerciseName: lift.exerciseName,
        fromKg: finiteOrNull(lift.fromKg) ?? 0,
        fromDate: lift.fromDate ?? '',
        toKg: finiteOrNull(lift.toKg) ?? 0,
        toDate: lift.toDate ?? ''
      }))
      .filter((lift) => lift.fromKg > 0 && lift.toKg > 0)
  };
}
