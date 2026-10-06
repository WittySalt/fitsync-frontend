import { BadgeNode, BadgesModel, Footprint, FootprintDay } from './me.models';

/** Tuesday 6 Oct 2026, the clock of the spec's examples. */
export const TODAY = '2026-10-06';

export function node(code: string, name: string, theme: string, progress: [number, number, string], earnedOn: string | null = null, extra: Partial<BadgeNode> = {}): BadgeNode {
  return {
    code,
    theme,
    name,
    how: `${name} (how)`,
    earnedOn,
    progress: { current: progress[0], target: progress[1], unit: progress[2] },
    evidence: null,
    pace: null,
    ...extra
  };
}

const FULL_WEEK = node('FULL_WEEK', 'A full week', 'SHOWING_UP', [1, 1, 'weeks'], '2026-09-27', {
  evidence: { weekStart: '2026-09-21', sessionId: null, recordId: null, line: null }
});

/** The steady account: seven of seventeen earned, 31 workouts, 5 of 7 days logged in a row. */
export const BADGES: BadgesModel = {
  earned: 7,
  total: 17,
  since: '2026-08-04',
  latest: FULL_WEEK,
  nextUp: [
    node('WORKOUTS_50', '50 workouts', 'SHOWING_UP', [31, 50, 'workouts']),
    node('SEVEN_DAYS_LOGGED', 'Seven days logged', 'EATING_WELL', [5, 7, 'days'])
  ],
  earlier: [],
  themes: [
    {
      code: 'SHOWING_UP',
      name: 'Showing up',
      paths: [
        {
          nodes: [
            node('FIRST_WORKOUT', 'First workout', 'SHOWING_UP', [1, 1, 'workouts'], '2026-08-07'),
            node('WORKOUTS_10', '10 workouts', 'SHOWING_UP', [10, 10, 'workouts'], '2026-08-24'),
            node('WORKOUTS_50', '50 workouts', 'SHOWING_UP', [31, 50, 'workouts']),
            node('WORKOUTS_100', '100 workouts', 'SHOWING_UP', [31, 100, 'workouts'])
          ]
        },
        {
          nodes: [FULL_WEEK, node('FOUR_FULL_WEEKS', 'Four weeks in a row', 'SHOWING_UP', [1, 4, 'weeks'])]
        }
      ]
    },
    {
      code: 'GETTING_STRONGER',
      name: 'Getting stronger',
      paths: [
        {
          nodes: [
            node('FIRST_RECORD', 'First record', 'GETTING_STRONGER', [1, 1, 'records'], '2026-08-07'),
            node('FIVE_RECORDS', 'Five records', 'GETTING_STRONGER', [3, 5, 'records']),
            node('BODYWEIGHT_BENCH', 'Bodyweight bench', 'GETTING_STRONGER', [0.42, 1, 'x body weight'])
          ]
        }
      ]
    },
    {
      code: 'EATING_WELL',
      name: 'Eating well',
      paths: [
        {
          nodes: [
            node('FIRST_MEAL', 'First meal logged', 'EATING_WELL', [1, 1, 'meals'], '2026-08-04'),
            node('SEVEN_DAYS_LOGGED', 'Seven days logged', 'EATING_WELL', [5, 7, 'days']),
            node('THIRTY_DAYS_LOGGED', 'Thirty days logged', 'EATING_WELL', [26, 30, 'days'])
          ]
        },
        {
          nodes: [
            node('PROTEIN_WEEK', 'Protein week', 'EATING_WELL', [1, 1, 'weeks'], '2026-09-14'),
            node('PROTEIN_MONTH', 'Protein month', 'EATING_WELL', [0, 1, 'months'], null, { how: 'every logged day of a month' })
          ]
        }
      ]
    },
    {
      code: 'IN_THE_KITCHEN',
      name: 'In the kitchen',
      paths: [
        {
          nodes: [
            node('FIRST_COOK', 'First cook', 'IN_THE_KITCHEN', [1, 1, 'cooks'], '2026-10-02'),
            node('TEN_COOKS', 'Ten cooks', 'IN_THE_KITCHEN', [1, 10, 'cooks']),
            node('FIFTY_COOKS', 'Fifty cooks', 'IN_THE_KITCHEN', [1, 50, 'cooks'])
          ]
        }
      ]
    }
  ]
};

export function days(from: string, to: string, mark: (date: string) => Partial<FootprintDay> = () => ({})): FootprintDay[] {
  const list: FootprintDay[] = [];
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= Date.parse(`${to}T00:00:00Z`); time += 86_400_000) {
    const date = new Date(time).toISOString().slice(0, 10);
    list.push({ date, trained: false, logged: false, ...mark(date) });
  }
  return list;
}

/** From Monday 3 Aug to Tuesday 6 Oct; the week of 21 Sept trained on 21, 24, 25 and 26. */
export const FOOTPRINT: Footprint = {
  memberSince: '2026-08-04',
  from: '2026-08-03',
  to: '2026-10-11',
  days: days('2026-08-03', TODAY, (date) => ({
    trained: ['2026-09-21', '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-06'].includes(date),
    logged: date >= '2026-08-04' && date !== '2026-08-08'
  })),
  totals: { workouts: 31, daysLogged: 58, badges: 7 }
};

describe('me fixtures', () => {
  it('has seventeen badges across four themes', () => {
    const nodes = BADGES.themes.flatMap((theme) => theme.paths.flatMap((path) => path.nodes));
    expect(nodes.length).toBe(17);
    expect(BADGES.themes.length).toBe(4);
    expect(nodes.filter((entry) => entry.earnedOn).length).toBe(BADGES.earned);
  });
});
