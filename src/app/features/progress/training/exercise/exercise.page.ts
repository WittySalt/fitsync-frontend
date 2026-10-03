import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { groupLabel } from '../../../../shared/charts/muscle-figure/muscle-figure';
import {
  ContentsRailComponent,
  DetailHeadComponent,
  DetailLayoutComponent,
  DetailSectionComponent,
  HeroStat,
  InkSwitchComponent,
  JumpItem,
  SummaryLinesComponent,
  periodEyebrow
} from '../../../../shared/progress';
import { StatePanelComponent } from '../../../../shared/state-panel.component';
import { AskChipComponent } from '../parts/ask-chip.component';
import { SeriesChartComponent } from '../parts/series-chart.component';
import { TrainingApiService } from '../training-api.service';
import { grouped, kg, plural, shortDate, signedKg } from '../training-format';
import { shownData, useLoad, usePeriod } from '../training-load';
import { PERIODS } from '../training-period';
import { ExerciseProgress, ExerciseSeriesKey } from '../training.models';
import { ExerciseHistoryComponent } from './exercise-history.component';

const FAILURE = 'This exercise could not load. Please retry.';

export const SERIES_TABS: { key: ExerciseSeriesKey; label: string; unit: string }[] = [
  { key: 'e1rm', label: 'Best single', unit: 'kg' },
  { key: 'heaviest', label: 'Heaviest weight', unit: 'kg' },
  { key: 'volume', label: 'Volume', unit: 'kg' },
  { key: 'reps', label: 'Reps', unit: 'reps' }
];

export const EXERCISE_SECTIONS: readonly JumpItem[] = [
  { id: 'summary', label: 'What the numbers say' },
  { id: 'series', label: 'Progress' },
  { id: 'history', label: 'Every session' }
];

export const EXERCISE_QUESTIONS = ['When should I add weight?', 'How does my form look in the numbers?'];

function joinWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

export function exerciseSubtitle(data: ExerciseProgress): string {
  const groups = [data.primaryGroup, ...data.secondaryGroups].filter((group): group is string => !!group).map((group, index) => {
    const label = groupLabel(group.toUpperCase());
    return index === 0 ? label : label.toLowerCase();
  });
  const parts = [joinWords(groups), data.equipment ? data.equipment.toLowerCase().replace(/_/g, ' ') : ''];
  if (data.sessions !== null) {
    parts.push(`${plural(data.sessions, 'session')}${data.firstSeen ? ` since ${shortDate(data.firstSeen)}` : ''}`);
  }
  return parts.filter(Boolean).join(' · ');
}

export function exerciseTiles(data: ExerciseProgress): HeroStat[] {
  const tiles = data.tiles;
  return [
    {
      label: 'Estimated best single',
      value: tiles.e1rm ? `${kg(tiles.e1rm.value)} kg` : '–',
      context: tiles.e1rm?.changeKg != null ? `${signedKg(tiles.e1rm.changeKg)}${tiles.e1rm.since ? ` since ${shortDate(tiles.e1rm.since)}` : ''}` : ''
    },
    { label: 'Heaviest set', value: tiles.heaviestSet ? `${kg(tiles.heaviestSet.weightKg)} kg × ${tiles.heaviestSet.reps}` : '–', context: tiles.heaviestSet ? shortDate(tiles.heaviestSet.date) : '' },
    { label: 'Best volume', value: tiles.bestVolume ? `${grouped(tiles.bestVolume.kg)} kg` : '–', context: tiles.bestVolume ? 'in one session' : '' },
    { label: 'Records', value: tiles.records === null ? '–' : String(tiles.records), context: '' }
  ];
}

/** The page's answer: stronger with a kilo or more on the best single or a record, down with a kilo or more lost, steady otherwise. */
export function exerciseVerdict(data: ExerciseProgress): { text: string; tone: 'good' | 'ink' } {
  const change = data.tiles.e1rm?.changeKg ?? null;
  if (!data.tiles.e1rm) {
    return { text: 'Not enough yet.', tone: 'ink' };
  }
  if ((change !== null && change >= 1) || (data.tiles.records ?? 0) > 0) {
    return { text: 'Getting stronger.', tone: 'good' };
  }
  return change !== null && change <= -1 ? { text: 'Down a little.', tone: 'ink' } : { text: 'Holding steady.', tone: 'ink' };
}

/** The sentence under the verdict: the exercise, its muscles, and where its best single stands. */
export function exerciseSentence(data: ExerciseProgress): string {
  const now = data.tiles.e1rm;
  const subtitle = exerciseSubtitle(data);
  if (!now) {
    return subtitle ? `${data.name}, ${subtitle}.` : `${data.name}.`;
  }
  const moved = now.changeKg !== null && Math.abs(now.changeKg) >= 0.05 ? `, ${signedKg(now.changeKg)}${now.since ? ` since ${shortDate(now.since)}` : ''}` : '';
  return `${data.name} stands at an estimated best single of ${kg(now.value)} kg${moved}.`;
}

/** One exercise (board 17b in the system of 20c): figures, the coach's lines, the series with a switch and every session's sets with records marked. */
@Component({
  selector: 'app-exercise-page',
  imports: [
    AskChipComponent,
    ContentsRailComponent,
    DetailHeadComponent,
    DetailLayoutComponent,
    DetailSectionComponent,
    ExerciseHistoryComponent,
    InkSwitchComponent,
    SeriesChartComponent,
    StatePanelComponent,
    SummaryLinesComponent
  ],
  templateUrl: './exercise.page.html',
  styleUrl: './exercise.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExercisePage {
  private readonly api = inject(TrainingApiService);
  protected readonly period = usePeriod();
  protected readonly exerciseId = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('exerciseId') ?? '')), { initialValue: '' });
  private readonly request = computed(() => (this.exerciseId() ? { id: this.exerciseId(), ...this.period.range() } : null));
  private readonly read = useLoad(this.request, (request) => this.api.getExercise(request.id, request.from, request.to), FAILURE);
  protected readonly state = this.read.state;

  protected readonly tabs = SERIES_TABS;
  protected readonly tabOptions = SERIES_TABS.map((tab) => ({ value: tab.key, label: tab.label }));
  protected readonly periodOptions = PERIODS.map((option) => ({ value: option.code, label: option.label }));
  protected readonly sections = EXERCISE_SECTIONS;
  protected readonly questions = EXERCISE_QUESTIONS;
  protected readonly series = signal<ExerciseSeriesKey>('e1rm');

  protected readonly data = computed(() => shownData(this.state()));
  protected readonly eyebrow = computed(() => {
    const data = this.data();
    return periodEyebrow(data ? `Training · ${data.name}` : 'Training', this.period.code(), this.period.range().from, this.period.range().to);
  });
  protected readonly verdict = computed(() => (this.data() ? exerciseVerdict(this.data()!) : { text: '', tone: 'ink' as const }));
  protected readonly sentence = computed(() => (this.data() ? exerciseSentence(this.data()!) : ''));
  protected readonly subtitle = computed(() => (this.data() ? exerciseSubtitle(this.data()!) : ''));
  protected readonly tiles = computed(() => (this.data() ? exerciseTiles(this.data()!) : []));
  protected readonly tab = computed(() => SERIES_TABS.find((tab) => tab.key === this.series()) ?? SERIES_TABS[0]);
  protected readonly points = computed(() => this.data()?.series[this.series()] ?? []);
  protected readonly seriesLine = computed(() => {
    const points = this.points();
    const best = points.filter((point) => point.isRecord).length;
    return points.length >= 2 ? `${plural(points.length, 'session')} in this period, ${plural(best, 'record')}, each point the best of its session.` : 'Each point is the best of a session.';
  });
  protected readonly historyLine = computed(() => `${plural(this.data()?.history.length ?? 0, 'session')} with sets, newest first.`);
  protected readonly card = computed<CoachCardContext | null>(() => (this.exerciseId() ? { kind: 'EXERCISE', id: this.exerciseId(), ...this.period.range() } : null));

  protected pickSeries(value: string): void {
    const tab = SERIES_TABS.find((item) => item.key === value);
    if (tab) {
      this.series.set(tab.key);
    }
  }

  protected pickPeriod(value: string): void {
    const option = PERIODS.find((item) => item.code === value);
    if (option) {
      this.period.select(option.code);
    }
  }

  protected retry(): void {
    this.read.retry();
  }
}
