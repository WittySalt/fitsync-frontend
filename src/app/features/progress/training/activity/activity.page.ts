import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { CoachCardContext, CoachCardKind } from '../../../../core/coach/coach.models';
import { UserTimezoneService } from '../../../../core/user-timezone.service';
import { dateKeyInZone } from '../../../../core/zone-time';
import { SectionCardComponent, SummaryLinesComponent, WeekBar, WeekBarsComponent } from '../../../../shared/progress';
import { StatePanelComponent } from '../../../../shared/state-panel.component';
import { clockTime } from '../../../dashboard/brief/month/month-day';
import { AskChipComponent } from '../parts/ask-chip.component';
import { KindTileComponent } from '../parts/kind-tile.component';
import { PeriodSwitchComponent } from '../parts/period-switch.component';
import { TrainingApiService } from '../training-api.service';
import { WEEKDAY_NAMES, heroTime, kg, pace, plural, shortDate, weekdayOf } from '../training-format';
import { useLoad, usePeriod } from '../training-load';
import { ActivityProgress, TrainingKind } from '../training.models';
import { SessionChartComponent } from './session-chart.component';
import { WhenGridComponent } from './when-grid.component';

const FAILURE = 'This activity could not load. Please retry.';

const KIND_NAMES: Record<TrainingKind, string> = { STRENGTH: 'Strength', CARDIO: 'Cardio', SPORT: 'Sport', MOBILITY: 'Mobility' };
const CARD_KINDS: Record<TrainingKind, CoachCardKind> = { STRENGTH: 'STRENGTH', CARDIO: 'CARDIO', SPORT: 'SPORT', MOBILITY: 'TRAINING' };

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

export function activityTiles(data: ActivityProgress): { label: string; value: string; note: string }[] {
  const tiles = data.tiles;
  const sessions = tiles.sessions ?? data.sessions.length;
  const minutes = tiles.minutes ?? data.sessions.reduce((total, session) => total + session.minutes, 0);
  const effort = tiles.effort;
  return [
    { label: 'Time', value: heroTime(minutes), note: sessions ? `${Math.round(minutes / sessions)} min a session` : '' },
    { label: 'Weeks in a row', value: tiles.weeksInARow === null ? '–' : String(tiles.weeksInARow), note: 'weeks with a session' },
    { label: 'Longest session', value: tiles.longestSession ? `${Math.round(tiles.longestSession.minutes)} min` : '–', note: tiles.longestSession ? shortDate(tiles.longestSession.date) : '' },
    {
      label: 'Effort',
      value: effort.average === null ? '–' : `${kg(effort.average)} of 10`,
      note: effort.first !== null && effort.last !== null ? `${kg(effort.first)} → ${kg(effort.last)} in the period` : ''
    }
  ];
}

/** One activity (board 17c): figures, the coach's lines, each week, each session, when, and every session opening the session page. */
@Component({
  selector: 'app-activity-page',
  imports: [
    AskChipComponent,
    KindTileComponent,
    PeriodSwitchComponent,
    RouterLink,
    SectionCardComponent,
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
  private readonly zone = inject(UserTimezoneService);
  protected readonly period = usePeriod();
  protected readonly key = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('key') ?? '')), { initialValue: '' });
  private readonly request = computed(() => (this.key() ? { key: this.key(), ...this.period.range() } : null));
  private readonly read = useLoad(this.request, (request) => this.api.getActivity(request.key, request.from, request.to), FAILURE);
  protected readonly state = this.read.state;

  protected readonly data = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly tiles = computed(() => (this.data() ? activityTiles(this.data()!) : []));
  protected readonly subtitle = computed(() => {
    const data = this.data();
    return data ? `${KIND_NAMES[data.kind]} · ${plural(data.tiles.sessions ?? data.sessions.length, 'session')} in ${this.period.option().label.replace('1 year', 'the year')}` : '';
  });
  protected readonly card = computed<CoachCardContext | null>(() => {
    const data = this.data();
    return data ? { kind: CARD_KINDS[data.kind], id: data.key, ...this.period.range() } : null;
  });
  /** Minutes each week as the shared bars, in the activity's shade, the week under way drawn lighter. */
  protected readonly weekBars = computed<WeekBar[]>(() => {
    const data = this.data();
    return (data?.weekly ?? []).map((week) => ({
      label: shortDate(week.weekStart),
      value: Math.round(week.minutes),
      segments: [{ key: data!.kind, value: Math.round(week.minutes) }],
      current: week.current
    }));
  });
  protected readonly questions = computed(() => (this.data() ? activityQuestions(this.data()!.kind, this.data()!.name) : []));
  protected readonly rows = computed(() => {
    const zone = this.zone.zone();
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
  protected readonly backQuery = computed(() => (this.period.code() === '4w' ? null : { period: this.period.code() }));

  protected retry(): void {
    this.read.retry();
  }
}
