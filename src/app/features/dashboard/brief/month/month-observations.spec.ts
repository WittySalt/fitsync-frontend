import { monthInsight, septemberInsight } from './month-fixtures.spec';
import { buildMonthObservations, MonthObservationInput } from './month-observations';

function lines(input: MonthObservationInput): string[] {
  return buildMonthObservations(input).map((observation) => (observation.note ? `${observation.headline} ${observation.note}` : observation.headline));
}

describe('month observations', () => {
  const base = (): MonthObservationInput => ({ insight: septemberInsight(), weeklyTarget: 4, weights: null });

  it('takes the weeks first, then the records, then the streak, for the September fixture', () => {
    expect(lines(base())).toEqual([
      'Every full week reached four sessions. Three weeks on goal, one after another.',
      'Six personal records this month. On 3, 7, 10, 14, 21 and 24 September.',
      'Three days in a row was your longest run. Your longest streak this month.'
    ]);
  });

  it('puts the weight third when two weigh-ins moved it', () => {
    const found = lines({ ...base(), weights: { first: 72.5, last: 71.1, count: 4 } });
    expect(found[2]).toBe('Your weight is down 1.4 kg. From 72.5 to 71.1 kg this month.');
    expect(found.length).toBe(3);
  });

  it('writes a gain as up and leaves out a change under a tenth of a kilo and a single weigh-in', () => {
    const up = lines({ ...base(), weights: { first: 71.1, last: 71.7, count: 2 } });
    expect(up[2]).toBe('Your weight is up 0.6 kg. From 71.1 to 71.7 kg this month.');

    expect(lines({ ...base(), weights: { first: 71.1, last: 71.12, count: 2 } }).some((line) => line.startsWith('Your weight'))).toBeFalse();
    expect(lines({ ...base(), weights: { first: 71.1, last: 70, count: 1 } }).some((line) => line.startsWith('Your weight'))).toBeFalse();
  });

  it('says every week beat the last when the weeks rose without reaching the target', () => {
    const insight = septemberInsight();
    insight.weeks[1] = { ...insight.weeks[1], sessions: 1 };
    insight.weeks[2] = { ...insight.weeks[2], sessions: 3 };
    const first = buildMonthObservations({ insight, weeklyTarget: 4, weights: null })[0];
    expect(first.headline).toBe('Every week beat the last.');
    expect(first.note).toBe('One session, then three, then four.');
  });

  it('skips the weeks when they neither reached the target nor rose', () => {
    const insight = septemberInsight();
    insight.weeks[2] = { ...insight.weeks[2], sessions: 2 };
    expect(lines({ insight, weeklyTarget: 4, weights: null })[0]).toMatch(/^Six personal records/);
    expect(lines({ insight, weeklyTarget: null, weights: null })[0]).toMatch(/^Six personal records/);
  });

  it('needs at least two full weeks', () => {
    const insight = septemberInsight();
    insight.weeks = insight.weeks.slice(0, 2);
    expect(lines({ insight, weeklyTarget: 4, weights: null })[0]).toMatch(/^Six personal records/);
  });

  it('names a single record in the singular', () => {
    const insight = septemberInsight({ days: septemberInsight().days.slice(0, 1), totals: { sessions: 17, minutes: 815, records: 1, longestStreakDays: 2 } });
    expect(lines({ insight, weeklyTarget: null, weights: null })[0]).toBe('One personal record this month. On 3 September.');
  });

  it('leaves the sub-line out when no day carries the record', () => {
    const insight = septemberInsight({ days: [], totals: { sessions: 17, minutes: 815, records: 2, longestStreakDays: 2 } });
    const record = buildMonthObservations({ insight, weeklyTarget: null, weights: null })[0];
    expect(record.headline).toBe('Two personal records this month.');
    expect(record.note).toBe('');
  });

  it('compares with last month and names the leading group when nothing earlier applies', () => {
    const insight = septemberInsight({
      days: [],
      weeks: [],
      totals: { sessions: 17, minutes: 815, records: 0, longestStreakDays: 2 }
    });
    expect(lines({ insight, weeklyTarget: null, weights: null })).toEqual([
      'Two more sessions than August. 17 this month, 15 last month.',
      'Core led the month. 13 sessions trained it.'
    ]);
  });

  it('writes one more session in the singular and does not praise a drop', () => {
    const insight = septemberInsight({ days: [], weeks: [], muscles: [], totals: { sessions: 16, minutes: 815, records: 0, longestStreakDays: 1 } });
    expect(lines({ insight, weeklyTarget: null, weights: null })).toEqual(['One more session than August. 16 this month, 15 last month.']);

    const fewer = septemberInsight({ days: [], weeks: [], muscles: [], totals: { sessions: 10, minutes: 815, records: 0, longestStreakDays: 1 } });
    expect(buildMonthObservations({ insight: fewer, weeklyTarget: null, weights: null })).toEqual([]);
  });

  it('names two groups that share the lead and none when more than two do', () => {
    const quiet = { days: [], weeks: [], previousTotals: null, totals: { sessions: 5, minutes: 200, records: 0, longestStreakDays: 1 } };
    const two = septemberInsight({
      ...quiet,
      muscles: [
        { group: 'CHEST', label: 'Chest', sessions: 3 },
        { group: 'BACK', label: 'Back', sessions: 3 },
        { group: 'LEGS', label: 'Legs', sessions: 1 }
      ]
    });
    expect(lines({ insight: two, weeklyTarget: null, weights: null })).toEqual(['Chest and Back led the month. 3 sessions trained each.']);

    const three = septemberInsight({
      ...quiet,
      muscles: [
        { group: 'CHEST', label: 'Chest', sessions: 2 },
        { group: 'BACK', label: 'Back', sessions: 2 },
        { group: 'LEGS', label: 'Legs', sessions: 2 }
      ]
    });
    expect(buildMonthObservations({ insight: three, weeklyTarget: null, weights: null })).toEqual([]);
  });

  it('keeps at most three and gives nothing for a month with nothing to say', () => {
    expect(buildMonthObservations({ ...base(), weights: { first: 72, last: 71, count: 3 } }).length).toBe(3);
    const empty = monthInsight({ days: [], weeks: [], muscles: [], totals: { sessions: 0, minutes: 0, records: 0, longestStreakDays: 0 } });
    expect(buildMonthObservations({ insight: empty, weeklyTarget: 4, weights: null })).toEqual([]);
  });

  it('writes counts above twelve in digits', () => {
    const insight = septemberInsight({ days: [], weeks: [], totals: { sessions: 30, minutes: 815, records: 14, longestStreakDays: 14 } });
    const found = lines({ insight, weeklyTarget: null, weights: null });
    expect(found[0]).toBe('14 personal records this month.');
    expect(found[1]).toBe('14 days in a row was your longest run. Your longest streak this month.');
  });

  it('never mentions what is missing, other people or what to do', () => {
    const insight = septemberInsight();
    const found = lines({ insight, weeklyTarget: 4, weights: { first: 72.5, last: 71.1, count: 3 } }).concat(
      lines({ insight: septemberInsight({ days: [], weeks: [] }), weeklyTarget: null, weights: null })
    );
    for (const line of found) {
      expect(line).not.toMatch(/\b(miss|only|but|should|try|need|must|others|average|behind|less|fewer|lost)\b/i);
    }
  });
});
