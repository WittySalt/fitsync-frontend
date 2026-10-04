import { WorkoutSessionDetail } from '../../../core/fitsync.models';
import { StripRow } from './segment-timer';

/** The rows of a finished session's strip: planned against actual for every segment, in order. */
export function sessionStripRows(session: WorkoutSessionDetail | null | undefined): StripRow[] {
  return (session?.segments ?? []).map((segment) => ({
    label: segment.label,
    kind: segment.kind,
    plannedSeconds: segment.plannedSeconds,
    actualSeconds: segment.actualSeconds,
    status: segment.status
  }));
}
