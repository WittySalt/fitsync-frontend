import { WorkoutSessionDetail } from '../../core/fitsync.models';

export type LiveTrackerGoalType = 'MINUTES' | 'CALORIES';

export interface LiveTrackerGoal {
  type: LiveTrackerGoalType;
  target: number;
}

export interface LiveTrackerStartEvent {
  session: WorkoutSessionDetail;
  goal: LiveTrackerGoal | null;
}
