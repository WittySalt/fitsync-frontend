import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CARDIO_PLACES, CardioPlace, DraftDay, DraftSegment, EffortLevel, TargetKind } from './plan-draft';
import { LastCardio } from './plan-flow.api';
import { lastCardioLine, TARGET_UNITS, targetHint } from './cardio-text';
import { EffortChipsComponent } from './effort-chips.component';
import { PlanShapeComponent } from './segments/plan-shape.component';

const PLACE_LABELS: Record<CardioPlace, string> = { TREADMILL: 'Treadmill', OUTDOOR: 'Outdoor', BIKE: 'Bike', ROWER: 'Rower', OTHER: 'Other' };

/** The cardio day's card: what to aim at, where, the shape of the session as a strip, and the effort expected. */
@Component({
  selector: 'app-plan-cardio-card',
  imports: [PlanShapeComponent, EffortChipsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cardio-card.component.html',
  styleUrl: './cardio-card.component.scss'
})
export class CardioCardComponent {
  readonly day = input.required<DraftDay>();
  readonly last = input<LastCardio | null>(null);
  readonly patch = output<Partial<DraftDay>>();
  readonly minutesChange = output<number | null>();
  readonly segmentsChange = output<DraftSegment[]>();

  protected readonly targets: ReadonlyArray<{ kind: TargetKind; label: string }> = [
    { kind: 'MINUTES', label: 'Minutes' },
    { kind: 'DISTANCE', label: 'Distance' },
    { kind: 'PACE', label: 'Pace' }
  ];
  protected readonly units = TARGET_UNITS;
  protected readonly places = CARDIO_PLACES;
  protected readonly placeLabels = PLACE_LABELS;
  protected readonly hint = computed(() => targetHint(this.day()));
  protected readonly lastLine = computed(() => lastCardioLine(this.last()));

  protected chooseTarget(kind: TargetKind): void {
    const day = this.day();
    if (kind === day.targetKind) {
      return;
    }
    // Each target keeps its own number: minutes follow the day, the others start empty.
    this.patch.emit({ targetKind: kind, targetValue: kind === 'MINUTES' ? day.minutes : null });
  }

  protected setTarget(raw: string): void {
    const value = raw === '' ? null : Number(raw);
    if (value !== null && !Number.isFinite(value)) {
      return;
    }
    if (this.day().targetKind === 'MINUTES') {
      this.minutesChange.emit(value);
      return;
    }
    this.patch.emit({ targetValue: value });
  }

  protected setPlace(place: CardioPlace): void {
    this.patch.emit({ location: this.day().location === place ? null : place });
  }

  protected setEffort(effort: EffortLevel): void {
    this.patch.emit({ effort: this.day().effort === effort ? null : effort });
  }
}
