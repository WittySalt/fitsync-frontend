import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import {
  AcceptSessionDraftResponse,
  CoachMessageContext,
  CoachMessageResponse,
  CoachReading,
  CoachStreamEvent,
  CoachThread,
  CoachThreadDetail,
  DraftMetrics,
  ReadingStatus,
  ReadingSurface,
  Recommendation,
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
  private readonly recommendationsUrl = '/api/v1/recommendations';

  listRecommendations(): Observable<Recommendation[]> {
    return this.http.get<Recommendation[]>(this.recommendationsUrl);
  }

  refreshRecommendations(): Observable<void> {
    return this.http.post<void>(`${this.recommendationsUrl}/refresh`, {});
  }

  /**
   * One page's reading with the facts it stands on.
   *
   * The response is tidied here so that a missing list or an unknown status cannot break the
   * panel. Errors are passed on, because the panel hides itself on a failed request and must be
   * able to tell that apart from an empty answer.
   */
  getReading(surface: ReadingSurface, timezone: string): Observable<CoachReading> {
    const params = new HttpParams().set('timezone', timezone);
    return this.http
      .get<Partial<CoachReading>>(`${this.coachBaseUrl}/readings/${surface.toLowerCase()}`, { params })
      .pipe(map((response) => toCoachReading(surface, response)));
  }

  listThreads(): Observable<CoachThread[]> {
    return this.http.get<CoachThread[]>(`${this.coachBaseUrl}/threads`);
  }

  createThread(title?: string): Observable<CoachThread> {
    return this.http.post<CoachThread>(`${this.coachBaseUrl}/threads`, title ? { title } : {});
  }

  getThread(threadId: string): Observable<CoachThreadDetail> {
    return this.http.get<CoachThreadDetail>(`${this.coachBaseUrl}/threads/${threadId}`);
  }

  /** The plain, non-streaming turn. The fallback when the stream cannot be opened. */
  sendMessage(threadId: string, message: string, context?: CoachMessageContext): Observable<CoachMessageResponse> {
    return this.http
      .post<RawMessageResponse>(`${this.coachBaseUrl}/threads/${threadId}/messages`, messageBody(message, context))
      .pipe(map(toMessageResponse));
  }

  /**
   * The streaming turn, as an observable of typed events ending with `answer` or `error`.
   *
   * Completes after the answer. Errors only when the connection itself fails; a turn the coach
   * could not finish arrives as an `error` event, because that is what the server sends and the
   * store treats the two differently.
   */
  streamMessage(threadId: string, message: string, context?: CoachMessageContext): Observable<CoachStreamEvent> {
    return new Observable<CoachStreamEvent>((subscriber) => {
      const controller = new AbortController();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      };
      const token = this.auth.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch(`${this.coachBaseUrl}/threads/${threadId}/messages/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(messageBody(message, context)),
        signal: controller.signal
      })
        .then(async (response) => {
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

/** The body the server expects: `context` is left out entirely when there is none to send. */
function messageBody(message: string, context?: CoachMessageContext): { message: string; context?: CoachMessageContext } {
  return context ? { message, context } : { message };
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
        detail: fact.detail ?? ''
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
