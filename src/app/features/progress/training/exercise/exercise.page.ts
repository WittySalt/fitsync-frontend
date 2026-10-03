import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { CoachCardContext } from '../../../../core/coach/coach.models';
import { groupLabel } from '../../../../shared/charts/muscle-figure/muscle-figure';
import { SectionCardComponent, SummaryLinesComponent } from '../../../../shared/progress';
import { StatePanelComponent } from '../../../../shared/state-panel.component';
import { AskChipComponent } from '../parts/ask-chip.component';
import { KindTileComponent } from '../parts/kind-tile.component';
import { SeriesChartComponent } from '../parts/series-chart.component';
import { SegmentedComponent } from '../parts/segmented.component';
import { TrainingApiService } from '../training-api.service';
import { grouped, kg, plural, shortDate, signedKg } from '../training-format';
import { useLoad, usePeriod } from '../training-load';
import { PERIODS, PeriodCode } from '../training-period';
import { ExerciseProgress, ExerciseSeriesKey } from '../training.models';
import { ExerciseHistoryComponent } from './exercise-history.component';

const FAILURE = 'This exercise could not load. Please retry.';

export const SERIES_TABS: { key: ExerciseSeriesKey; label: string; unit: string }[] = [
  { key: 'e1rm', label: 'Best single', unit: 'kg' },
  { key: 'heaviest', label: 'Heaviest weight', unit: 'kg' },
  { key: 'volume', label: 'Volume', unit: 'kg' },
  { key: 'reps', label: 'Reps', unit: 'reps' }
];

const PERIOD_TABS: Record<PeriodCode, string> = { '4w': '1M', '3m': '3M', '1y': '1Y' };

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

export function exerciseTiles(data: ExerciseProgress): { label: string; value: string; note: string }[] {
  const tiles = data.tiles;
  return [
    {
      label: 'Estimated best single',
      value: tiles.e1rm ? `${kg(tiles.e1rm.value)} kg` : '–',
      note: tiles.e1rm?.changeKg != null ? `${signedKg(tiles.e1rm.changeKg)}${tiles.e1rm.since ? ` since ${shortDate(tiles.e1rm.since)}` : ''}` : ''
    },
    { label: 'Heaviest set', value: tiles.heaviestSet ? `${kg(tiles.heaviestSet.weightKg)} kg × ${tiles.heaviestSet.reps}` : '–', note: tiles.heaviestSet ? shortDate(tiles.heaviestSet.date) : '' },
    { label: 'Best volume', value: tiles.bestVolume ? `${grouped(tiles.bestVolume.kg)} kg` : '–', note: tiles.bestVolume ? 'in one session' : '' },
    { label: 'Records', value: tiles.records === null ? '–' : String(tiles.records), note: '' }
  ];
}

/** One exercise (board 17b): figures, the coach's lines, the series with a switch and every session's sets with records marked. */
@Component({
  selector: 'app-exercise-page',
  imports: [
    AskChipComponent,
    ExerciseHistoryComponent,
    KindTileComponent,
    RouterLink,
    SectionCardComponent,
    SegmentedComponent,
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
  protected readonly periods = PERIODS.map((option) => ({ value: option.code, label: PERIOD_TABS[option.code] }));
  protected readonly questions = EXERCISE_QUESTIONS;
  protected readonly series = signal<ExerciseSeriesKey>('e1rm');

  protected readonly data = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly subtitle = computed(() => (this.data() ? exerciseSubtitle(this.data()!) : ''));
  protected readonly tiles = computed(() => (this.data() ? exerciseTiles(this.data()!) : []));
  protected readonly tab = computed(() => SERIES_TABS.find((tab) => tab.key === this.series()) ?? SERIES_TABS[0]);
  protected readonly points = computed(() => this.data()?.series[this.series()] ?? []);
  protected readonly card = computed<CoachCardContext | null>(() => (this.exerciseId() ? { kind: 'EXERCISE', id: this.exerciseId(), ...this.period.range() } : null));
  protected readonly backQuery = computed(() => (this.period.code() === '4w' ? null : { period: this.period.code() }));

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
