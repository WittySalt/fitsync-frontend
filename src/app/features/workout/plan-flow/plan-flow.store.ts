import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, filter, switchMap } from 'rxjs';

import { WORKOUT_PLAN_TEMPLATES } from '../plan-templates.component';
import { PlanCoverage, readingLines } from './plan-coverage';
import { PlanFlowApi, PlanFlowContext } from './plan-flow.api';
import { weekFromTemplate } from './plan-flow.templates';
import {
  DEFAULT_PROFILE,
  DraftDay,
  DraftPlan,
  DraftSegment,
  emptyDay,
  emptyPlan,
  FlowKind,
  PlanProfile,
  PlanType,
  replaceDay,
  swapDays
} from './plan-draft';
import { DraftProblem, firstDayProblem, reviewProblem } from './plan-save';
import { derivePlanType, shortWeekLine, suggestPlanName, weekFigures, weekSummaryLine } from './plan-summary';
import { proposeWeek } from './plan-week-proposal';
import { defaultSegments, resizeTotal } from './segments/segment-math';

export type FlowStatus = 'loading' | 'ready' | 'error';

const DEFAULT_TITLES = new Set(['', 'Easy run', 'Mobility flow', 'Strength', 'Cardio', 'Mobility', 'Full body A', 'Full body B', 'Full body C', 'Upper', 'Lower', 'Full']);

/** The state of one pass through the plan flow. Provided by the flow page, so it ends with the page. */
@Injectable()
export class PlanFlowStore {
  private readonly api = inject(PlanFlowApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<FlowStatus>('loading');
  readonly plan = signal<DraftPlan>(emptyPlan());
  readonly profile = signal<PlanProfile>({ ...DEFAULT_PROFILE });
  readonly context = signal<PlanFlowContext | null>(null);
  readonly step = signal<1 | 2>(1);
  readonly selectedDay = signal(1);
  readonly kindsOpen = signal(false);
  readonly dirty = signal(false);
  readonly makeCurrent = signal(true);
  readonly problem = signal<DraftProblem | null>(null);
  readonly reviewMessage = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly coverage = signal<PlanCoverage | null>(null);
  readonly coverageFailed = signal(false);
  readonly profileSaving = signal(false);
  readonly profileError = signal<string | null>(null);
  private baseline: string | null = null;

  readonly editing = computed(() => this.plan().planId !== null);
  readonly days = computed(() => this.plan().days);
  readonly day = computed(() => this.days().find((entry) => entry.dayOfWeek === this.selectedDay()) ?? this.days()[0]);
  readonly figures = computed(() => weekFigures(this.days()));
  readonly shortLine = computed(() => shortWeekLine(this.figures()));
  readonly summaryLine = computed(() => weekSummaryLine(this.figures(), this.profile()));
  readonly lines = computed(() => readingLines(this.coverage()?.notes ?? [], this.days(), this.profile()));
  readonly sports = computed(() => this.context()?.sports ?? []);

  constructor() {
    toObservable(computed(() => ({ plan: this.plan(), profile: this.profile(), ready: this.status() === 'ready' && !this.coverageFailed() })))
      .pipe(
        debounceTime(500),
        filter((state) => state.ready && state.plan.days.some((day) => day.kind !== 'REST')),
        switchMap((state) => this.api.coverage(state.plan, state.profile)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((coverage) => {
        this.coverage.set(coverage);
        this.coverageFailed.set(coverage === null);
      });
  }

  /** Opens the flow: a saved plan to edit, a starter template, or the proposed default week. */
  start(planId: string | null, templateId: string | null): void {
    this.status.set('loading');
    this.api.load().subscribe({
      next: (context) => {
        this.context.set(context);
        this.profile.set(context.profile);
        this.makeCurrent.set(!planId && !context.currentPlanName);
        if (planId) {
          this.openSaved(planId);
        } else {
          this.openNew(context, templateId);
        }
      },
      error: () => this.status.set('error')
    });
  }

  private openSaved(planId: string): void {
    this.api.loadPlan(planId).subscribe({
      next: (draft) => {
        if (!draft) {
          this.status.set('error');
          return;
        }
        this.plan.set(draft);
        this.selectedDay.set(draft.days.find((day) => day.kind !== 'REST')?.dayOfWeek ?? 1);
        this.status.set('ready');
      },
      error: () => this.status.set('error')
    });
  }

  private openNew(context: PlanFlowContext, templateId: string | null): void {
    const template = WORKOUT_PLAN_TEMPLATES.find((entry) => entry.id === templateId);
    if (template) {
      this.api.resolveTemplate(template).subscribe((resolved) => {
        const days = resolved.moves.length ? weekFromTemplate(resolved, context.profile) : proposeWeek(context.profile, context.habits);
        this.begin(days, false);
      });
      return;
    }
    this.api.proposal(context.profile).subscribe((server) => this.begin(server ?? proposeWeek(context.profile, context.habits), true));
  }

  private begin(days: DraftDay[], proposed: boolean): void {
    this.plan.set({ ...emptyPlan(), days, planType: derivePlanType(days) });
    this.baseline = proposed ? JSON.stringify(days) : null;
    this.selectedDay.set(days.find((day) => day.kind !== 'REST')?.dayOfWeek ?? 1);
    this.dirty.set(false);
    this.status.set('ready');
  }

  select(dayOfWeek: number): void {
    this.selectedDay.set(dayOfWeek);
    this.kindsOpen.set(this.days().find((day) => day.dayOfWeek === dayOfWeek)?.kind === 'REST');
    this.problem.set(null);
  }

  private commit(days: DraftDay[]): void {
    this.plan.update((plan) => ({ ...plan, days }));
    this.dirty.set(true);
  }

  updateDay(dayOfWeek: number, patch: Partial<DraftDay>): void {
    this.commit(replaceDay(this.days(), dayOfWeek, (day) => ({ ...day, ...patch })));
    this.problem.set(null);
  }

  setMinutes(dayOfWeek: number, minutes: number | null): void {
    this.commit(
      replaceDay(this.days(), dayOfWeek, (day) => {
        const resized = minutes && (day.kind === 'CARDIO' || day.kind === 'SPORT') ? resizeTotal(day.segments, minutes) : day.segments;
        const follows = day.kind === 'CARDIO' && day.targetKind === 'MINUTES';
        return { ...day, minutes, segments: resized, targetValue: follows ? minutes : day.targetValue };
      })
    );
    this.problem.set(null);
  }

  setSegments(dayOfWeek: number, segments: DraftSegment[]): void {
    this.updateDay(dayOfWeek, { segments });
  }

  moveDay(from: number, to: number): void {
    this.commit(swapDays(this.days(), from, to));
    this.selectedDay.set(to);
  }

  /** Swaps a day's kind: the body of the editor changes, and a title the person typed stays. */
  setKind(dayOfWeek: number, kind: FlowKind): void {
    const current = this.days().find((day) => day.dayOfWeek === dayOfWeek);
    if (!current || current.kind === kind) {
      this.kindsOpen.set(kind === 'REST');
      return;
    }
    const typed = !DEFAULT_TITLES.has(current.title.trim()) && current.kind !== 'SPORT';
    const minutes = current.minutes && current.minutes > 0 ? current.minutes : this.defaultMinutes(kind);
    const fresh: DraftDay = { ...emptyDay(dayOfWeek), planDayId: current.planDayId, kind, minutes: kind === 'REST' ? null : minutes };
    if (kind === 'REST') {
      this.commit(replaceDay(this.days(), dayOfWeek, () => fresh));
      this.kindsOpen.set(true);
      return;
    }
    fresh.title = typed ? current.title : this.defaultTitle(kind);
    if (kind === 'CARDIO' || kind === 'SPORT') {
      fresh.segments = defaultSegments(minutes);
      fresh.effort = 'MODERATE';
    }
    if (kind === 'CARDIO') {
      fresh.targetKind = 'MINUTES';
      fresh.targetValue = minutes;
    }
    if (kind === 'STRENGTH' || kind === 'MOBILITY') {
      fresh.moves = [];
    }
    this.commit(replaceDay(this.days(), dayOfWeek, () => fresh));
    this.kindsOpen.set(false);
    if (kind === 'MOBILITY') {
      this.api.mobilityFlow().subscribe((moves) => {
        const day = this.days().find((entry) => entry.dayOfWeek === dayOfWeek);
        if (moves.length && day?.kind === 'MOBILITY' && day.moves.length === 0) {
          this.commit(replaceDay(this.days(), dayOfWeek, (entry) => ({ ...entry, moves })));
        }
      });
    }
  }

  private defaultMinutes(kind: FlowKind): number {
    return kind === 'CARDIO' ? 30 : kind === 'SPORT' ? 60 : this.profile().preferredDurationMinutes || 45;
  }

  private defaultTitle(kind: FlowKind): string {
    return kind === 'CARDIO' ? 'Easy run' : kind === 'MOBILITY' ? 'Mobility flow' : kind === 'STRENGTH' ? 'Strength' : '';
  }

  setEffort(dayOfWeek: number, effort: DraftDay['effort']): void {
    this.updateDay(dayOfWeek, { effort });
  }

  /** The inline form of the profile card: saves the five fields, and proposes the week again only while it is untouched. */
  saveProfile(next: PlanProfile): void {
    this.profileSaving.set(true);
    this.profileError.set(null);
    this.api.saveProfile(next, this.context()?.preferences ?? null).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.profile.set(next);
        this.repropose(next);
      },
      error: () => {
        this.profileSaving.set(false);
        this.profileError.set('The profile could not be saved. Try again.');
      }
    });
  }

  private repropose(profile: PlanProfile): void {
    const untouched = this.baseline !== null && JSON.stringify(this.days()) === this.baseline && !this.dirty();
    if (!untouched) {
      return;
    }
    const habits = this.context()?.habits ?? [];
    this.api.proposal(profile).subscribe((server) => {
      const days = server ?? proposeWeek(profile, habits);
      this.baseline = JSON.stringify(days);
      this.plan.update((plan) => ({ ...plan, days, planType: derivePlanType(days) }));
      this.selectedDay.set(days.find((day) => day.kind !== 'REST')?.dayOfWeek ?? 1);
    });
  }

  /** Continue: the first thing to fix is shown and its day opened; otherwise step 2 begins with a name filled in. */
  goReview(): void {
    const problem = firstDayProblem(this.plan());
    this.problem.set(problem);
    if (problem) {
      if (problem.dayOfWeek) {
        this.selectedDay.set(problem.dayOfWeek);
      }
      return;
    }
    this.plan.update((plan) => ({
      ...plan,
      name: plan.nameTyped ? plan.name : suggestPlanName(plan.days),
      planType: plan.typeTyped ? plan.planType : derivePlanType(plan.days)
    }));
    this.step.set(2);
  }

  goBuild(): void {
    this.step.set(1);
    this.reviewMessage.set(null);
  }

  setName(name: string): void {
    this.plan.update((plan) => ({ ...plan, name, nameTyped: true }));
    this.dirty.set(true);
  }

  setPlanType(planType: PlanType): void {
    this.plan.update((plan) => ({ ...plan, planType, typeTyped: true }));
    this.dirty.set(true);
  }

  setDescription(description: string): void {
    this.plan.update((plan) => ({ ...plan, description }));
    this.dirty.set(true);
  }

  /** Saves the plan. Emits the saved plan's id; fails with a message on the store. */
  save(onSaved: (planId: string) => void): void {
    const message = reviewProblem(this.plan()) ?? (firstDayProblem(this.plan())?.message ?? null);
    this.reviewMessage.set(message);
    if (message || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    this.api.save(this.plan(), this.profile(), this.makeCurrent()).subscribe({
      next: (planId) => {
        this.saving.set(false);
        this.dirty.set(false);
        onSaved(planId);
      },
      error: () => {
        this.saving.set(false);
        this.saveError.set('The plan could not be saved. Your changes are still here.');
      }
    });
  }
}
