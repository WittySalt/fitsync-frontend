import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import {
  AcceptSessionDraftResponse,
  CoachMessageResponse,
  CoachStreamEvent,
  CoachThread,
  CoachThreadDetail,
  DraftMetrics,
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
  sendMessage(threadId: string, message: string): Observable<CoachMessageResponse> {
    return this.http.post<CoachMessageResponse>(`${this.coachBaseUrl}/threads/${threadId}/messages`, { message });
  }

  /**
   * The streaming turn, as an observable of typed events ending with `answer` or `error`.
   *
   * Completes after the answer. Errors only when the connection itself fails; a turn the coach
   * could not finish arrives as an `error` event, because that is what the server sends and the
   * store treats the two differently.
   */
  streamMessage(threadId: string, message: string): Observable<CoachStreamEvent> {
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
        body: JSON.stringify({ message }),
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
      return { name, data: JSON.parse(data) };
    case 'error':
      return { name, data: stripQuotes(data) };
    default:
      return null;
  }
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
