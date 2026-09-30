import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

export interface RuleCount {
  rule: string;
  count: number;
}

export interface CoachAnswerTotals {
  total: number;
  passed: number;
  rejected: number;
  refused: number;
  modelUnavailable: number;
  other: number;
  rejectedByRule: RuleCount[];
  refusedByRule: RuleCount[];
}

export interface CoachLatency {
  count: number;
  medianMs: number;
  p95Ms: number;
}

export interface CoachTierCount {
  tier: string;
  count: number;
}

export interface CoachModelCount {
  model: string;
  count: number;
}

export interface CoachToolStat {
  tool: string;
  calls: number;
  failed: number;
  medianMs: number;
}

export interface CoachReadingCount {
  surface: string;
  source: string;
  outcome: string;
  count: number;
}

export interface CoachDailyCount {
  date: string;
  answers: number;
  passed: number;
  rejected: number;
  refused: number;
  modelUnavailable: number;
}

export interface CoachQuality {
  from: string;
  to: string;
  timezone: string;
  answers: CoachAnswerTotals;
  latency: CoachLatency;
  tiers: CoachTierCount[];
  models: CoachModelCount[];
  tools: CoachToolStat[];
  readings: CoachReadingCount[];
  daily: CoachDailyCount[];
}

export interface ExerciseTypeCount {
  type: string;
  count: number;
}

export interface ExerciseSummary {
  total: number;
  byType: ExerciseTypeCount[];
}

/** Only how many terms could not be mapped is kept, because the page never shows the terms themselves. */
export interface CatalogueImportResult {
  processed: number;
  created: number;
  updated: number;
  rejected: number;
  unmappedTermCount: number;
}

export type OutboxService = 'auth' | 'users' | 'workouts' | 'nutrition';

export interface OutboxPending {
  pending: number;
  /** An ISO instant, or null when nothing is waiting. */
  oldestCreatedAt: string | null;
}

export interface OutboxPublishResult {
  requestedBatchSize: number;
  publishedCount: number;
}

export interface AdminUser {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  authProvider: string;
}

export interface RebuildResult {
  userId: string;
  scope: string;
  date: string;
  rebuiltAt: string;
}

export interface GoalReconcileResult {
  publishedCount: number;
}

/** How many waiting events one press of Publish sends. */
export const OUTBOX_BATCH_SIZE = 50;

/** The response as it may arrive: every part is optional so that a missing one cannot break the page. */
type Loose<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? Loose<U>[] | null : T[K] extends object ? Loose<T[K]> | null : T[K] | null };

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  // The gateway names the service first ("coach") and the service's own path repeats it.
  private readonly coachQualityUrl = '/api/v1/admin/coach/coach/quality';
  private readonly adminUrl = '/api/v1/admin';
  // The workout service's own path repeats its name as well.
  private readonly workoutsUrl = '/api/v1/admin/workouts/workouts';

  getCoachQuality(from: string, to: string, timezone: string): Observable<CoachQuality> {
    const params = new HttpParams().set('from', from).set('to', to).set('timezone', timezone);
    return this.http.get<Loose<CoachQuality>>(this.coachQualityUrl, { params }).pipe(map((body) => toCoachQuality(body)));
  }

  getExerciseSummary(): Observable<ExerciseSummary> {
    return this.http.get<Loose<ExerciseSummary>>(`${this.workoutsUrl}/exercises/summary`).pipe(map((body) => toExerciseSummary(body)));
  }

  importExerciseCatalogue(): Observable<CatalogueImportResult> {
    return this.http.post<Loose<CatalogueImportResult> & { unmappedTerms?: unknown }>(`${this.workoutsUrl}/exercises/import-catalog`, null).pipe(
      map((body) => toImportResult(body))
    );
  }

  getOutboxPending(service: OutboxService): Observable<OutboxPending> {
    return this.http.get<Loose<OutboxPending>>(`${this.adminUrl}/${service}/outbox/pending`).pipe(map((body) => toOutboxPending(body)));
  }

  publishOutbox(service: OutboxService): Observable<OutboxPublishResult> {
    const params = new HttpParams().set('batchSize', OUTBOX_BATCH_SIZE);
    return this.http.post<Loose<OutboxPublishResult>>(`${this.adminUrl}/${service}/outbox/publish`, null, { params }).pipe(
      map((body) => toPublishResult(body))
    );
  }

  /** The email travels in the body because a query string would be written to access logs. */
  lookupUser(email: string): Observable<AdminUser> {
    return this.http.post<Loose<AdminUser>>(`${this.adminUrl}/auth/users/lookup`, { email }).pipe(map((body) => toAdminUser(body)));
  }

  rebuildDashboard(userId: string): Observable<RebuildResult> {
    return this.http.post<Loose<RebuildResult>>(`${this.analyticsUrl(userId)}/dashboard/rebuild`, null).pipe(map((body) => toRebuildResult(body)));
  }

  rebuildNutrition(userId: string, date: string): Observable<RebuildResult> {
    const params = new HttpParams().set('date', date);
    return this.http.post<Loose<RebuildResult>>(`${this.analyticsUrl(userId)}/nutrition/rebuild`, null, { params }).pipe(
      map((body) => toRebuildResult(body))
    );
  }

  rebuildWorkouts(userId: string, date: string): Observable<RebuildResult> {
    const params = new HttpParams().set('date', date);
    return this.http.post<Loose<RebuildResult>>(`${this.analyticsUrl(userId)}/workouts/rebuild`, null, { params }).pipe(
      map((body) => toRebuildResult(body))
    );
  }

  reconcileGoals(): Observable<GoalReconcileResult> {
    return this.http.post<Loose<GoalReconcileResult>>(`${this.adminUrl}/users/goals/reconcile`, null).pipe(map((body) => toReconcileResult(body)));
  }

  private analyticsUrl(userId: string): string {
    return `${this.adminUrl}/analytics/analytics/users/${encodeURIComponent(userId)}`;
  }
}

export function toCoachQuality(body: Loose<CoachQuality> | null | undefined): CoachQuality {
  const answers = body?.answers;
  const latency = body?.latency;
  return {
    from: text(body?.from),
    to: text(body?.to),
    timezone: text(body?.timezone),
    answers: {
      total: count(answers?.total),
      passed: count(answers?.passed),
      rejected: count(answers?.rejected),
      refused: count(answers?.refused),
      modelUnavailable: count(answers?.modelUnavailable),
      other: count(answers?.other),
      rejectedByRule: list(answers?.rejectedByRule).map((row) => ({ rule: text(row.rule), count: count(row.count) })),
      refusedByRule: list(answers?.refusedByRule).map((row) => ({ rule: text(row.rule), count: count(row.count) }))
    },
    latency: { count: count(latency?.count), medianMs: count(latency?.medianMs), p95Ms: count(latency?.p95Ms) },
    tiers: list(body?.tiers).map((row) => ({ tier: text(row.tier), count: count(row.count) })),
    models: list(body?.models).map((row) => ({ model: text(row.model), count: count(row.count) })),
    tools: list(body?.tools).map((row) => ({
      tool: text(row.tool),
      calls: count(row.calls),
      failed: count(row.failed),
      medianMs: count(row.medianMs)
    })),
    readings: list(body?.readings).map((row) => ({
      surface: text(row.surface),
      source: text(row.source),
      outcome: text(row.outcome),
      count: count(row.count)
    })),
    daily: list(body?.daily).map((row) => ({
      date: text(row.date),
      answers: count(row.answers),
      passed: count(row.passed),
      rejected: count(row.rejected),
      refused: count(row.refused),
      modelUnavailable: count(row.modelUnavailable)
    }))
  };
}

export function toExerciseSummary(body: Loose<ExerciseSummary> | null | undefined): ExerciseSummary {
  return {
    total: count(body?.total),
    byType: list(body?.byType).map((row) => ({ type: text(row.type), count: count(row.count) }))
  };
}

export function toImportResult(body: (Loose<CatalogueImportResult> & { unmappedTerms?: unknown }) | null | undefined): CatalogueImportResult {
  return {
    processed: count(body?.processed),
    created: count(body?.created),
    updated: count(body?.updated),
    rejected: count(body?.rejected),
    unmappedTermCount: Array.isArray(body?.unmappedTerms) ? body.unmappedTerms.length : 0
  };
}

export function toOutboxPending(body: Loose<OutboxPending> | null | undefined): OutboxPending {
  return { pending: count(body?.pending), oldestCreatedAt: text(body?.oldestCreatedAt) || null };
}

export function toPublishResult(body: Loose<OutboxPublishResult> | null | undefined): OutboxPublishResult {
  return { requestedBatchSize: count(body?.requestedBatchSize), publishedCount: count(body?.publishedCount) };
}

export function toAdminUser(body: Loose<AdminUser> | null | undefined): AdminUser {
  return {
    userId: text(body?.userId),
    email: text(body?.email),
    displayName: text(body?.displayName),
    role: text(body?.role),
    authProvider: text(body?.authProvider)
  };
}

export function toRebuildResult(body: Loose<RebuildResult> | null | undefined): RebuildResult {
  return { userId: text(body?.userId), scope: text(body?.scope), date: text(body?.date), rebuiltAt: text(body?.rebuiltAt) };
}

export function toReconcileResult(body: Loose<GoalReconcileResult> | null | undefined): GoalReconcileResult {
  return { publishedCount: count(body?.publishedCount) };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value.filter((row) => row !== null && typeof row === 'object') : [];
}
