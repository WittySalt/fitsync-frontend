import { Component, computed, input, output } from '@angular/core';

import { WorkoutSessionDetail } from '../../core/fitsync.models';
import { SegmentStripComponent } from './plan-flow/segments/segment-strip.component';
import { sessionStripRows } from './segments/session-segments';
import { doneSetCount, recordExercises, recordStats } from './session-record';

/**
 * What a finished session holds, as the session page shows it: a row of figures, then one card for
 * each exercise with a mark for each set (done, skipped, not done) and only the columns that hold
 * something. A cancelled session with sets done says so once, with the one button that counts it.
 */
@Component({
  selector: 'app-session-record',
  imports: [SegmentStripComponent],
  template: `
    <dl class="stats" [style.--columns]="stats().length">
      @for (stat of stats(); track stat.label) {
        <div class="stat">
          <dt>{{ stat.label }}</dt>
          <dd>
            <span class="value">{{ stat.value }}</span>
            @if (stat.unit) {
              <span class="unit">{{ stat.unit }}</span>
            }
          </dd>
          <dd class="note">{{ stat.note }}</dd>
        </div>
      }
    </dl>

    @if (countable()) {
      <div class="count-bar">
        <span>{{ countLine() }}</span>
        <button type="button" class="count" [disabled]="busy()" (click)="count.emit()">Count this workout</button>
      </div>
    }

    @if (session().notes) {
      <p class="notes">{{ session().notes }}</p>
    }

    @if (segmentRows().length) {
      <section class="segments" aria-label="Segments">
        <h3 class="segments-title">Segments</h3>
        <app-segment-strip [rows]="segmentRows()" [editable]="false" />
      </section>
    }

    @for (exercise of exercises(); track exercise.key) {
      @if (exercise.untouched) {
        <section class="exercise folded" [attr.aria-label]="exercise.name + ', ' + exercise.summary">
          <span class="number" aria-hidden="true">{{ exercise.sequence }}</span>
          <strong class="name">{{ exercise.name }}</strong>
          <span class="summary">{{ exercise.summary }}</span>
        </section>
      } @else {
        <section class="exercise">
          <div class="exercise-head">
            <span class="number" aria-hidden="true">{{ exercise.sequence }}</span>
            <div class="titles">
              <h3 class="name">{{ exercise.name }}</h3>
              <span class="summary">{{ exercise.summary }}</span>
            </div>
          </div>
          @if (exercise.rows.length) {
            <table [attr.aria-label]="exercise.name + ' sets'">
              <thead>
                <tr>
                  <th scope="col"><span class="visually-hidden">State</span></th>
                  <th scope="col">Set</th>
                  <th scope="col">{{ exercise.doneHeading }}</th>
                  @if (exercise.columns.rest) {
                    <th scope="col">Rest</th>
                  }
                  @if (exercise.columns.rpe) {
                    <th scope="col">RPE</th>
                  }
                  @if (exercise.columns.notes) {
                    <th scope="col">Notes</th>
                  } @else {
                    <th class="fill" aria-hidden="true"></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of exercise.rows; track row.setNumber) {
                  <tr [class]="row.state">
                    <td>
                      <span class="mark" [class]="'mark ' + row.state" role="img"
                        [attr.aria-label]="row.state === 'done' ? 'Done' : row.state === 'skipped' ? 'Skipped' : 'Not done'"></span>
                    </td>
                    <td class="set-number">{{ row.setNumber }}</td>
                    <td [class.muted]="row.done.muted">{{ row.done.text }}</td>
                    @if (row.rest; as rest) {
                      <td [class.muted]="rest.muted">
                        {{ rest.text }}
                        @if (rest.note) {
                          <span class="cell-note">{{ rest.note }}</span>
                        }
                      </td>
                    }
                    @if (row.rpe; as rpe) {
                      <td [class.muted]="rpe.muted">{{ rpe.text }}</td>
                    }
                    @if (row.notes; as notes) {
                      <td class="note-cell" [class.muted]="notes.muted">{{ notes.text }}</td>
                    } @else {
                      <td class="fill" aria-hidden="true"></td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }
    }
  `,
  styleUrl: './session-record.component.scss'
})
export class SessionRecordComponent {
  readonly session = input.required<WorkoutSessionDetail>();
  readonly busy = input(false);
  /** "Count this workout" on a cancelled session that has sets done. */
  readonly count = output<void>();

  protected readonly stats = computed(() => recordStats(this.session()));
  protected readonly exercises = computed(() => recordExercises(this.session()));
  protected readonly segmentRows = computed(() => sessionStripRows(this.session()));
  protected readonly doneSets = computed(() => doneSetCount(this.session()));
  protected readonly countable = computed(() => this.session().status === 'CANCELLED' && this.doneSets() > 0);
  protected readonly countLine = computed(() => {
    const done = this.doneSets();
    return `${done} ${done === 1 ? 'set' : 'sets'} done, not counted in your totals`;
  });
}
