import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatSets, groupLabel, heatLevel } from '../../../../shared/charts/muscle-figure/muscle-figure';
import { MuscleGroupSets } from '../training.models';

/** The tapped group: its hard sets a week against the usual range and the exercises that trained it. */
@Component({
  selector: 'app-muscle-group-detail',
  imports: [RouterLink],
  template: `
    <div class="head">
      <span [class]="'swatch ' + view().level"></span>
      <strong>{{ view().label }}</strong>
      <button type="button" class="close" (click)="closed.emit()">Close</button>
    </div>
    <p>{{ view().sentence }}</p>
    @if (view().exercises.length) {
      <div class="row cols" aria-hidden="true"><span>Exercise</span><span>A week</span></div>
      <ul>
        @for (exercise of view().exercises; track exercise.exerciseId || exercise.name) {
          <li class="row">
            @if (exercise.exerciseId) {
              <a [routerLink]="['/progress/training/exercises', exercise.exerciseId]">{{ exercise.name }}</a>
            } @else {
              <span class="name">{{ exercise.name }}</span>
            }
            <span class="sets">{{ exercise.text }} sets</span>
          </li>
        }
      </ul>
    } @else {
      <p class="quiet">No exercise trained this group in the period.</p>
    }
    <p class="quiet">{{ note() }}</p>
  `,
  styleUrl: './muscle-group-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MuscleGroupDetailComponent {
  readonly group = input.required<string>();
  readonly sets = input<MuscleGroupSets | null>(null);
  readonly range = input<{ low: number; high: number }>({ low: 10, high: 20 });
  readonly note = input('');
  readonly closed = output<void>();

  protected readonly view = computed(() => {
    const value = this.sets()?.setsPerWeek ?? 0;
    const range = this.range();
    const where = value < range.low ? 'under' : value > range.high ? 'above' : 'inside';
    return {
      label: groupLabel(this.group()),
      level: heatLevel(value, range),
      sentence: `${formatSets(value)} hard sets a week, ${where} the usual ${range.low} to ${range.high}.`,
      exercises: [...(this.sets()?.exercises ?? [])].sort((a, b) => b.sets - a.sets).map((exercise) => ({ ...exercise, text: formatSets(exercise.sets) }))
    };
  });
}
