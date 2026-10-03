import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CoachCardContext, CoachCardKind } from '../../../core/coach/coach.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import {
  ContentsRailComponent,
  DetailHeadComponent,
  DetailLayoutComponent,
  DetailSectionComponent,
  HeroStat,
  HighlightsComponent,
  InkSwitchComponent,
  JumpItem,
  NO_EARLIER_DATA,
  periodEyebrow
} from '../../../shared/progress';
import { ActivityCardComponent } from './parts/activity-card.component';
import { minutesTop } from './parts/chart-geometry';
import { LoadSectionComponent } from './parts/load-section.component';
import { LogSectionComponent } from './parts/log-section.component';
import { MuscleSectionComponent } from './parts/muscle-section.component';
import { RecordsSectionComponent } from './parts/records-section.component';
import { StrengthSectionComponent } from './parts/strength-section.component';
import { TrainingApiService } from './training-api.service';
import { grouped, heroChange, heroTime, plural, unitValue } from './training-format';
import { shownData, useLoad, usePeriod } from './training-load';
import { PERIODS, PeriodCode } from './training-period';
import { TrainingProgress } from './training.models';

const FAILURE = 'Training progress could not load. Please retry.';

/** The sections of the page, in order, as the contents rail lists them. */
export const TRAINING_SECTIONS: readonly JumpItem[] = [
  { id: 'highlights', label: 'Highlights' },
  { id: 'activities', label: 'By activity' },
  { id: 'strength', label: 'Strength' },
  { id: 'muscles', label: 'Muscles' },
  { id: 'load', label: 'Training load' },
  { id: 'log', label: 'Training log' },
  { id: 'records', label: 'Records' }
];

/** A compared figure's line: its change, or "No earlier data" when there is nothing to compare with. */
function against(value: number | null, previous: number | null, kind: 'count' | 'minutes' | 'pct'): string {
  if (value === null) {
    return '';
  }
  if (previous === null || (kind === 'pct' && previous <= 0)) {
    return NO_EARLIER_DATA;
  }
  return heroChange(value, previous, kind);
}

export function heroTiles(progress: TrainingProgress): HeroStat[] {
  const hero = progress.hero;
  const value = (number: number | null, format: (value: number) => string): string => (number === null ? '–' : format(number));
  const records = hero.records.exercises.slice(0, 3).map((name) => name.toLowerCase()).join(', ');
  return [
    { label: 'Sessions', value: value(hero.sessions.value, String), context: against(hero.sessions.value, hero.sessions.previous, 'count') },
    { label: 'Time', value: value(hero.minutes.value, heroTime), context: against(hero.minutes.value, hero.minutes.previous, 'minutes') },
    { label: 'Training load', value: value(hero.load.value, grouped), context: against(hero.load.value, hero.load.previous, 'pct') },
    { label: 'Records', value: value(hero.records.value, String), context: records }
  ];
}

/** What a period is called in the verdict and in the sentence under it. */
const PERIOD_NOUNS: Record<PeriodCode, { noun: string; within: string }> = {
  '4w': { noun: 'month', within: 'in four weeks' },
  '3m': { noun: 'quarter', within: 'in three months' },
  '1y': { noun: 'year', within: 'in the year' }
};

/**
 * The page's answer: strong with three new records in a month, quiet under four sessions, steady
 * otherwise. A longer period scales both thresholds by its length in weeks.
 */
export function trainingVerdict(progress: TrainingProgress, code: PeriodCode): { text: string; tone: 'good' | 'ink' } {
  const weeks = PERIODS.find((option) => option.code === code)?.weeks ?? 4;
  const noun = PERIOD_NOUNS[code].noun;
  const sessions = progress.hero.sessions.value ?? 0;
  const records = progress.hero.records.value ?? 0;
  if (records >= Math.ceil((3 * weeks) / 4)) {
    return { text: `Strong ${noun}.`, tone: 'good' };
  }
  if (sessions < weeks) {
    return { text: `Quiet ${noun}.`, tone: 'ink' };
  }
  return { text: `Steady ${noun}.`, tone: 'good' };
}

/** The sentence under the verdict, from the page's own figures. */
export function trainingSentence(progress: TrainingProgress, code: PeriodCode): string {
  const { sessions, minutes, records } = progress.hero;
  if (sessions.value === null) {
    return 'Finish a session and this page fills in.';
  }
  const within = PERIOD_NOUNS[code].within;
  const time = minutes.value === null ? '' : ` and ${heroTime(minutes.value)}`;
  const record = records.value ? `, ${plural(records.value, 'new record')}` : '';
  return `${plural(sessions.value, 'session')}${time} ${within}${record}.`;
}

/**
 * The Training page (board 20c's system): the verdict and four figures, Highlights, By activity,
 * Strength, the muscle figure, Training load, the log and Records, each section with Ask. The
 * period lives in the URL.
 */
@Component({
  selector: 'app-training-page',
  imports: [
    ActivityCardComponent,
    ContentsRailComponent,
    DetailHeadComponent,
    DetailLayoutComponent,
    DetailSectionComponent,
    HighlightsComponent,
    InkSwitchComponent,
    LoadSectionComponent,
    LogSectionComponent,
    MuscleSectionComponent,
    RecordsSectionComponent,
    RouterLink,
    StatePanelComponent,
    StrengthSectionComponent
  ],
  templateUrl: './training.page.html',
  styleUrl: './training.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainingPage {
  private readonly api = inject(TrainingApiService);
  protected readonly period = usePeriod();
  private readonly read = useLoad(this.period.range, (range) => this.api.getTraining(range.from, range.to), FAILURE);
  protected readonly state = this.read.state;

  protected readonly periodOptions = PERIODS.map((option) => ({ value: option.code, label: option.label }));
  protected readonly sections = TRAINING_SECTIONS;
  protected readonly unitValue = unitValue;
  protected readonly eyebrow = computed(() => periodEyebrow('Training', this.period.code(), this.period.range().from, this.period.range().to));
  protected readonly data = computed(() => shownData(this.state()));
  protected readonly verdict = computed(() => {
    const data = this.data();
    return data ? trainingVerdict(data, this.period.code()) : { text: '', tone: 'ink' as const };
  });
  protected readonly sentence = computed(() => {
    const data = this.data();
    return data ? trainingSentence(data, this.period.code()) : '';
  });
  protected readonly tiles = computed(() => {
    const data = this.data();
    return data ? heroTiles(data) : [];
  });
  protected readonly activityTop = computed(() => minutesTop(Math.max(0, ...(this.data()?.activities ?? []).map((activity) => activity.minutes))));
  protected readonly activityLine = computed(() => {
    const activities = this.data()?.activities ?? [];
    const top = [...activities].sort((a, b) => b.minutes - a.minutes)[0];
    return top ? `${plural(activities.length, 'kind')} of training, and ${top.name.toLowerCase()} took the most time.` : '';
  });
  protected readonly empty = computed(() => {
    const data = this.data();
    return data !== null && !data.calendar.length && !data.activities.length && (data.hero.sessions.value ?? 0) === 0;
  });

  /** The subject of Ask on each section, with the page's period. */
  protected readonly cards = computed(() => {
    const range = this.period.range();
    const card = (kind: CoachCardKind, id?: string): CoachCardContext => (id ? { kind, id, ...range } : { kind, ...range });
    return {
      training: card('TRAINING'),
      strength: card('STRENGTH'),
      muscles: card('TRAINING', 'muscles'),
      load: card('TRAINING', 'load'),
      log: card('TRAINING', 'log'),
      records: card('STRENGTH', 'records')
    };
  });

  protected retry(): void {
    this.read.retry();
  }

  protected choose(code: string): void {
    const option = PERIODS.find((period) => period.code === code);
    if (option) {
      this.period.select(option.code);
    }
  }
}
