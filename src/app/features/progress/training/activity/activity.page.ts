import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { CoachCardContext, CoachCardKind } from '../../../../core/coach/coach.models';
import { UserTimezoneService } from '../../../../core/user-timezone.service';
import { dateKeyInZone } from '../../../../core/zone-time';
import {
  ContentsRailComponent,
  DetailHeadComponent,
  DetailLayoutComponent,
  DetailSectionComponent,
  HeroStat,
  InkSwitchComponent,
  JumpItem,
  SummaryLinesComponent,
  WeekBar,
  WeekBarsComponent,
  periodEyebrow
} from '../../../../shared/progress';
import { StatePanelComponent } from '../../../../shared/state-panel.component';
import { clockTime } from '../../../dashboard/brief/month/month-day';
import { AskChipComponent } from '../parts/ask-chip.component';
import { TrainingApiService } from '../training-api.service';
import { WEEKDAY_NAMES, heroTime, kg, pace, plural, shortDate, weekdayOf } from '../training-format';
import { shownData, useLoad, usePeriod } from '../training-load';
import { PERIODS, PeriodCode } from '../training-period';
import { ActivityProgress, TrainingKind } from '../training.models';
import { busiestSlot } from './activity-geometry';
import { SessionChartComponent } from './session-chart.component';
import { WhenGridComponent } from './when-grid.component';

const FAILURE = 'This activity could not load. Please retry.';

const CARD_KINDS: Record<TrainingKind, CoachCardKind> = { STRENGTH: 'STRENGTH', CARDIO: 'CARDIO', SPORT: 'SPORT', MOBILITY: 'TRAINING' };

export const ACTIVITY_SECTIONS: readonly JumpItem[] = [
  { id: 'summary', label: 'What the numbers say' },
  { id: 'weeks', label: 'Each week' },
  { id: 'sessions-chart', label: 'Each session' },
  { id: 'when', label: 'When you train' },
  { id: 'sessions', label: 'Sessions' }
];

/** The suggested questions under the coach's lines, by kind; the frontend holds the copy (contract 4.1). */
export function activityQuestions(kind: TrainingKind, name: string): string[] {
  switch (kind) {
    case 'SPORT':
      return [`Should I eat more on ${name.toLowerCase()} days?`, 'Is it enough cardio?'];
    case 'CARDIO':
      return ['Am I getting fitter?', 'Should I go longer or faster?'];
    case 'MOBILITY':
      return ['Is this enough mobility?'];
    default:
      return ['Is my strength going up?', 'Should I train more often?'];
  }
}

export function activityTiles(data: ActivityProgress): HeroStat[] {
  const tiles = data.tiles;
  const sessions = tiles.sessions ?? data.sessions.length;
  const minutes = tiles.minutes ?? data.sessions.reduce((total, session) => total + session.minutes, 0);
  const effort = tiles.effort;
  return [
    { label: 'Time', value: heroTime(minutes), context: sessions ? `${Math.round(minutes / sessions)} min a session` : '' },
    { label: 'Weeks in a row', value: tiles.weeksInARow === null ? '–' : String(tiles.weeksInARow), context: 'weeks with a session' },
    { label: 'Longest session', value: tiles.longestSession ? `${Math.round(tiles.longestSession.minutes)} min` : '–', context: tiles.longestSession ? shortDate(tiles.longestSession.date) : '' },
    {
      label: 'Effort',
      value: effort.average === null ? '–' : `${kg(effort.average)} of 10`,
      context: effort.first !== null && effort.last !== null ? `${kg(effort.first)} → ${kg(effort.last)} in the period` : ''
    }
  ];
}

/** The page's answer: every week of the period, a run of weeks, or on and off; nothing yet without sessions. */
export function activityVerdict(data: ActivityProgress, code: PeriodCode): { text: string; tone: 'good' | 'ink' } {
  const weeks = PERIODS.find((option) => option.code === code)?.weeks ?? 4;
  const sessions = data.tiles.sessions ?? data.sessions.length;
  const run = data.tiles.weeksInARow ?? 0;
  if (!sessions) {
    return { text: 'Nothing yet.', tone: 'ink' };
  }
  if (run >= weeks) {
    return { text: 'Every week.', tone: 'good' };
  }
  return run >= 2 ? { text: 'Keeping it up.', tone: 'good' } : { text: 'On and off.', tone: 'ink' };
}

/** The sentence under the verdict, from the figures of the page. */
export function activitySentence(data: ActivityProgress, code: PeriodCode): string {
  const sessions = data.tiles.sessions ?? data.sessions.length;
  const minutes = data.tiles.minutes ?? data.sessions.reduce((total, session) => total + session.minutes, 0);
  const within = { '4w': 'in four weeks', '3m': 'in three months', '1y': 'in the year' }[code];
  if (!sessions) {
    return `No ${data.name.toLowerCase()} sessions ${within}.`;
  }
  const run = data.tiles.weeksInARow;
  return `${plural(sessions, 'session')} and ${heroTime(minutes)} ${within}${run ? `, ${plural(run, 'week')} in a row` : ''}.`;
}

/** One activity (board 17c in the system of 20c): figures, the coach's lines, each week, each session, when, and every session opening the session page. */
@Component({
  selector: 'app-activity-page',
  imports: [
    AskChipComponent,
    ContentsRailComponent,
    DetailHeadComponent,
    DetailLayoutComponent,
    DetailSectionComponent,
    InkSwitchComponent,
    RouterLink,
    SessionChartComponent,
    StatePanelComponent,
    SummaryLinesComponent,
    WeekBarsComponent,
    WhenGridComponent
  ],
  templateUrl: './activity.page.html',
  styleUrl: './activity.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityPage {
  private readonly api = inject(TrainingApiService);
  private readonly timezone = inject(UserTimezoneService);
  protected readonly period = usePeriod();
  protected readonly key = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('key') ?? '')), { initialValue: '' });
  private readonly request = computed(() => (this.key() ? { key: this.key(), ...this.period.range() } : null));
  private readonly read = useLoad(this.request, (request) => this.api.getActivity(request.key, request.from, request.to), FAILURE);
  protected readonly state = this.read.state;

  protected readonly periodOptions = PERIODS.map((option) => ({ value: option.code, label: option.label }));
  protected readonly sections = ACTIVITY_SECTIONS;
  protected readonly data = computed(() => shownData(this.state()));
  protected readonly hasSessions = computed(() => {
    const data = this.data();
    return !!data && (data.sessions.length > 0 || data.weekly.length > 0);
  });
  protected readonly eyebrow = computed(() => {
    const data = this.data();
    return periodEyebrow(data ? `Training · ${data.name}` : 'Training', this.period.code(), this.period.range().from, this.period.range().to);
  });
  protected readonly verdict = computed(() => (this.data() ? activityVerdict(this.data()!, this.period.code()) : { text: '', tone: 'ink' as const }));
  protected readonly sentence = computed(() => (this.data() ? activitySentence(this.data()!, this.period.code()) : ''));
  protected readonly tiles = computed(() => (this.data() ? activityTiles(this.data()!) : []));
  protected readonly card = computed<CoachCardContext | null>(() => {
    const data = this.data();
    return data ? { kind: CARD_KINDS[data.kind], id: data.key, ...this.period.range() } : null;
  });
  /** Minutes each week as the shared bars, in the activity's shade, the week under way drawn lighter. */
  protected readonly weekBars = computed<WeekBar[]>(() => {
    const data = this.data();
    return (data?.weekly ?? []).map((week) => ({
      label: shortDate(week.weekStart),
      weekStart: week.weekStart,
      value: Math.round(week.minutes),
      segments: [{ key: data!.kind, value: Math.round(week.minutes) }],
      current: week.current
    }));
  });
  protected readonly weekLine = computed(() => {
    const top = [...(this.data()?.weekly ?? [])].sort((a, b) => b.minutes - a.minutes)[0];
    return top && top.minutes > 0 ? `The most time was the week of ${shortDate(top.weekStart)}, ${heroTime(top.minutes)}.` : 'Minutes in each week, Monday to Sunday.';
  });
  protected readonly sessionLine = computed(() => {
    const longest = this.data()?.tiles.longestSession;
    return longest ? `Your longest session was ${Math.round(longest.minutes)} min on ${shortDate(longest.date)}.` : 'Minutes of each session, with the effort you gave it.';
  });
  protected readonly whenLine = computed(() => {
    const slot = busiestSlot(this.data()?.whenGrid ?? []);
    return slot ? `You train most on ${slot.day}s around ${slot.hour}:00.` : 'The start time of each session, by weekday.';
  });
  protected readonly sessionsLine = computed(() => `${plural(this.data()?.sessions.length ?? 0, 'session')}, newest first. Each opens its page from Workout History.`);
  protected readonly questions = computed(() => (this.data() ? activityQuestions(this.data()!.kind, this.data()!.name) : []));
  protected readonly rows = computed(() => {
    const zone = this.timezone.zone();
    return [...(this.data()?.sessions ?? [])]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .map((session) => {
        const date = session.startedAt ? dateKeyInZone(new Date(session.startedAt), zone) : '';
        const parts = [`${date ? WEEKDAY_NAMES[weekdayOf(date)] : ''} ${clockTime(session.startedAt, zone)}`.trim(), `${Math.round(session.minutes)} min`];
        if (session.distanceKm !== null) {
          parts.push(`${kg(session.distanceKm)} km`);
        }
        if (session.paceSecPerKm !== null) {
          parts.push(`${pace(session.paceSecPerKm)} a km`);
        }
        if (session.effort !== null) {
          parts.push(`effort ${Math.round(session.effort)}${session.estimatedEffort ? ' (usual)' : ''}`);
        }
        return { id: session.sessionId, date: date ? shortDate(date) : '', line: parts.filter(Boolean).join(' · '), kcal: session.calories === null ? '' : `${Math.round(session.calories)} kcal` };
      });
  });

  protected choose(code: string): void {
    const option = PERIODS.find((period) => period.code === code);
    if (option) {
      this.period.select(option.code);
    }
  }

  protected retry(): void {
    this.read.retry();
  }
}
