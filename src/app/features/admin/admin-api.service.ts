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

/** The response as it may arrive: every part is optional so that a missing one cannot break the page. */
type Loose<T> = { [K in keyof T]?: T[K] extends (infer U)[] ? Loose<U>[] | null : T[K] extends object ? Loose<T[K]> | null : T[K] | null };

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  // The gateway names the service first ("coach") and the service's own path repeats it.
  private readonly coachQualityUrl = '/api/v1/admin/coach/coach/quality';

  getCoachQuality(from: string, to: string, timezone: string): Observable<CoachQuality> {
    const params = new HttpParams().set('from', from).set('to', to).set('timezone', timezone);
    return this.http.get<Loose<CoachQuality>>(this.coachQualityUrl, { params }).pipe(map((body) => toCoachQuality(body)));
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

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value.filter((row) => row !== null && typeof row === 'object') : [];
}
