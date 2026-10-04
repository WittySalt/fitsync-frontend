import { Observable } from 'rxjs';

import { SegmentUpdateInput, WorkoutSessionDetail, WorkoutSessionSegment } from '../../../core/fitsync.models';
import { SegmentSettled } from './segment-timer';

export type SegmentSender = (entryId: string, input: SegmentUpdateInput) => Observable<WorkoutSessionDetail>;

/**
 * The writes of settled segments. Each one is sent as soon as the segment's entry id is known; one
 * whose id is missing waits until a session answer brings it. A failed write stays queued and goes
 * again on the next flush. Only the newest write of a segment is kept.
 */
export class SegmentWriteQueue {
  private readonly waiting = new Map<number, SegmentSettled>();
  private readonly inFlight = new Set<number>();
  private readonly ids = new Map<number, string>();

  constructor(private readonly send: SegmentSender) {}

  get pending(): number {
    return this.waiting.size;
  }

  /** Remembers the entry ids of a session answer and sends what was waiting for them. */
  learn(segments: readonly WorkoutSessionSegment[] | undefined): void {
    for (const segment of segments ?? []) {
      if (segment.entryId) {
        this.ids.set(segment.position, segment.entryId);
      }
    }
    this.flush();
  }

  push(settled: readonly SegmentSettled[]): void {
    for (const item of settled) {
      this.waiting.set(item.position, item);
    }
    this.flush();
  }

  flush(): void {
    for (const [position, item] of [...this.waiting]) {
      const entryId = this.ids.get(position);
      if (!entryId || this.inFlight.has(position)) {
        continue;
      }
      this.inFlight.add(position);
      this.send(entryId, { actualSeconds: item.actualSeconds, startedAt: item.startedAt, status: item.status }).subscribe({
        next: (session) => {
          this.inFlight.delete(position);
          if (this.waiting.get(position) === item) {
            this.waiting.delete(position);
          }
          this.learn(session.segments);
        },
        error: () => this.inFlight.delete(position)
      });
    }
  }
}
