import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CoachCardContext, CoachCardKind } from '../../../core/coach/coach.models';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { ActivityCardComponent } from './parts/activity-card.component';
import { minutesTop } from './parts/chart-geometry';
import { HighlightsComponent } from './parts/highlights.component';
import { LoadSectionComponent } from './parts/load-section.component';
import { LogSectionComponent } from './parts/log-section.component';
import { MuscleSectionComponent } from './parts/muscle-section.component';
import { PeriodSwitchComponent } from './parts/period-switch.component';
import { HeroTile, ProgressHeroComponent } from './parts/progress-hero.component';
import { RecordsSectionComponent } from './parts/records-section.component';
import { SectionCardComponent } from './parts/section-card.component';
import { StrengthSectionComponent } from './parts/strength-section.component';
import { TrainingApiService } from './training-api.service';
import { grouped, heroChange, heroTime, rangeLabel } from './training-format';
import { useLoad, usePeriod } from './training-load';
import { TrainingProgress } from './training.models';

const FAILURE = 'Training progress could not load. Please retry.';

export function heroTiles(progress: TrainingProgress): HeroTile[] {
  const hero = progress.hero;
  const value = (number: number | null, format: (value: number) => string): string => (number === null ? '–' : format(number));
  const records = hero.records.exercises.slice(0, 3).map((name) => name.toLowerCase()).join(', ');
  return [
    { label: 'Sessions', value: value(hero.sessions.value, String), change: heroChange(hero.sessions.value, hero.sessions.previous, 'count') },
    { label: 'Time', value: value(hero.minutes.value, heroTime), change: heroChange(hero.minutes.value, hero.minutes.previous, 'minutes') },
    { label: 'Training load', value: value(hero.load.value, grouped), change: heroChange(hero.load.value, hero.load.previous, 'pct') },
    { label: 'Records', value: value(hero.records.value, String), change: records }
  ];
}

/**
 * The Training page (board 18a): the hero, Highlights, By activity, Strength, the muscle figure,
 * Training load, the log and Records, each section with Ask. The period lives in the URL.
 */
@Component({
  selector: 'app-training-page',
  imports: [
    ActivityCardComponent,
    HighlightsComponent,
    LoadSectionComponent,
    LogSectionComponent,
    MuscleSectionComponent,
    PeriodSwitchComponent,
    ProgressHeroComponent,
    RecordsSectionComponent,
    RouterLink,
    SectionCardComponent,
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

  protected readonly title = computed(() => rangeLabel(this.period.range().from, this.period.range().to));
  protected readonly note = computed(() => `Each change is compared with ${this.period.option().before}.`);
  protected readonly highlightsSub = computed(() => {
    const code = this.period.code();
    return `one finding each, from ${code === '1y' ? 'this year' : `these ${this.period.option().label}`}`;
  });
  protected readonly data = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly tiles = computed(() => {
    const data = this.data();
    return data ? heroTiles(data) : [];
  });
  protected readonly activityTop = computed(() => minutesTop(Math.max(0, ...(this.data()?.activities ?? []).map((activity) => activity.minutes))));
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
}
