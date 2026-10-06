/** One day of the footprint grid. */
export interface FootprintDay {
  date: string;
  trained: boolean;
  logged: boolean;
}

/** The whole membership as the Me page draws it: every day from the Monday on or before the member-since date. */
export interface Footprint {
  memberSince: string;
  from: string;
  to: string;
  days: FootprintDay[];
  totals: { workouts: number; daysLogged: number; badges: number };
}

export type BadgeTheme = 'SHOWING_UP' | 'GETTING_STRONGER' | 'EATING_WELL' | 'IN_THE_KITCHEN';

export interface BadgeProgress {
  current: number;
  target: number;
  unit: string;
}

export interface BadgeEvidence {
  weekStart: string | null;
  sessionId: string | null;
  recordId: string | null;
  /** A ready sentence from the server when it sends one; the page writes its own otherwise. */
  line: string | null;
}

export interface BadgeNode {
  code: string;
  theme: string;
  name: string;
  how: string;
  /** The day it was earned (yyyy-mm-dd), or null while it is still open. */
  earnedOn: string | null;
  progress: BadgeProgress;
  evidence: BadgeEvidence | null;
  /** Units of progress per week when the server can say it (workouts a week); null otherwise. */
  pace: number | null;
}

export interface BadgePath {
  nodes: BadgeNode[];
}

export interface BadgeThemeGroup {
  code: string;
  name: string;
  paths: BadgePath[];
}

export interface BadgesModel {
  themes: BadgeThemeGroup[];
  earned: number;
  total: number;
  latest: BadgeNode | null;
  nextUp: BadgeNode[];
  /** Badges retired from the catalogue that someone earned before; they stay as a small row. */
  earlier: BadgeNode[];
  /** The day the membership began (yyyy-mm-dd), for the page head; empty when not sent. */
  since: string;
}
