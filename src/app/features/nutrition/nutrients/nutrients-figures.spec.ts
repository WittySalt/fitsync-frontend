import {
  BAR_TOP,
  PETAL_CAP,
  amountOfReference,
  dayBars,
  dayBarsSummary,
  figureText,
  groupNutrients,
  heroLine,
  neighbours,
  parsePeriod,
  periodRange,
  petalGeometry,
  petalSummary,
  reachSummary,
  tableOrder,
  tileFill,
  tileLabel,
  tileState
} from './nutrients-figures';
import { day, nutrients, tile } from './nutrients-testing.spec';

describe('nutrient figures', () => {
  describe('periods', () => {
    it('defaults to 7 days and reads the period named in the URL', () => {
      expect(parsePeriod(null)).toBe('7d');
      expect(parsePeriod('nonsense')).toBe('7d');
      expect(parsePeriod('today')).toBe('today');
      expect(parsePeriod('30d')).toBe('30d');
    });

    it('counts back from today', () => {
      expect(periodRange('today', '2026-10-02')).toEqual({ from: '2026-10-02', to: '2026-10-02', days: 1 });
      expect(periodRange('7d', '2026-10-02')).toEqual({ from: '2026-09-26', to: '2026-10-02', days: 7 });
      expect(periodRange('30d', '2026-10-02')).toEqual({ from: '2026-09-03', to: '2026-10-02', days: 30 });
    });
  });

  describe('tile states', () => {
    it('is unknown without data', () => {
      expect(tileState(tile({ share: null }))).toBe('unknown');
      expect(tileFill(tile({ share: null }))).toBe(0);
    });

    it('is below until the daily amount and reached from it', () => {
      expect(tileState(tile({ share: 0.99 }))).toBe('below');
      expect(tileState(tile({ share: 1 }))).toBe('reached');
      expect(tileState(tile({ share: 2.3 }))).toBe('reached');
    });

    it('fills from the bottom by the share and never past full', () => {
      expect(tileFill(tile({ share: 0.34 }))).toBeCloseTo(34);
      expect(tileFill(tile({ share: 1.88 }))).toBe(100);
    });

    it('is under a limit until it is passed, then over', () => {
      expect(tileState(tile({ groupCode: 'LIMIT', share: 0.82 }))).toBe('under');
      expect(tileState(tile({ groupCode: 'LIMIT', share: 1 }))).toBe('under');
      expect(tileState(tile({ groupCode: 'LIMIT', share: 1.15 }))).toBe('over');
    });

    it('speaks each state', () => {
      expect(tileLabel(tile({ share: 0.34 }))).toBe('Vitamin D, 34% of the daily amount');
      expect(tileLabel(tile({ share: null }))).toBe('Vitamin D, no data yet');
      expect(tileLabel(tile({ displayName: 'Sodium', groupCode: 'LIMIT', share: 1.15 }))).toBe('Sodium, 115% of the daily limit, over');
      expect(tileLabel(tile({ displayName: 'Sugar', groupCode: 'LIMIT', share: 0.82 }))).toBe('Sugar, 82% of the daily limit');
    });
  });

  describe('amounts', () => {
    it('prints figures the way a label does', () => {
      expect(figureText(5.1)).toBe('5.1');
      expect(figureText(15)).toBe('15');
      expect(figureText(0.9)).toBe('0.9');
      expect(figureText(0.123)).toBe('0.12');
      expect(figureText(2110)).toBe('2,110');
      expect(figureText(1.5)).toBe('1.5');
    });

    it('says what was eaten of the daily amount', () => {
      expect(amountOfReference(tile({ share: 0.34, averageAmount: 5.1 }))).toBe('5.1 of 15 µg');
      expect(amountOfReference(tile({ share: null }))).toBe('');
    });
  });

  describe('the table', () => {
    it('groups in the order of the groups and keeps the limits last', () => {
      const groups = groupNutrients([...nutrients()].reverse());
      expect(groups.map((block) => block.group)).toEqual(['FAT_SOLUBLE', 'WATER_SOLUBLE', 'MAJOR_MINERAL', 'TRACE_MINERAL', 'LIMIT']);
    });

    it('gives the order the arrows walk, with ends that have no neighbour', () => {
      const order = tableOrder(nutrients());
      expect(order[0].code).toBe('VITAMIN_D');
      expect(neighbours(order, 'VITAMIN_D')).toEqual({ previous: null, next: order[1] });
      expect(neighbours(order, 'VITAMIN_E').previous?.code).toBe('VITAMIN_D');
      expect(neighbours(order, 'SODIUM').next).toBeNull();
      expect(neighbours(order, 'UNKNOWN')).toEqual({ previous: null, next: null });
    });
  });

  describe('the reading of the period', () => {
    it('counts the reached vitamins and minerals and finds the three lowest', () => {
      const summary = reachSummary(nutrients());
      expect(summary.total).toBe(6);
      expect(summary.reached).toBe(2);
      expect(summary.lowest.map((item) => item.code)).toEqual(['VITAMIN_D', 'VITAMIN_E', 'POTASSIUM']);
    });

    it('leaves the unknown and the limits out of the lowest', () => {
      const summary = reachSummary(nutrients());
      expect(summary.lowest.some((item) => item.code === 'ZINC' || item.code === 'SODIUM')).toBeFalse();
    });

    it('writes the sentence', () => {
      expect(heroLine(reachSummary(nutrients()), '30d')).toBe('2 of 6 reached on average. Vitamin D is the furthest short.');
      expect(heroLine(reachSummary(nutrients()), 'today')).toBe('2 of 6 reached. Vitamin D is the furthest short.');
      expect(heroLine(reachSummary([tile({ share: 1.2 })]), '7d')).toBe('1 of 1 reached on average. Every nutrient is reached.');
      expect(heroLine(reachSummary([tile({ share: null })]), '7d')).toBe('');
    });

    it('has a text for screen readers that names the lowest', () => {
      expect(petalSummary(reachSummary(nutrients()), '7d')).toContain('Lowest: Vitamin D 34%, Vitamin E 61%, Potassium 62%.');
      expect(petalSummary(reachSummary([]), '7d')).toBe('No nutrient data for this period yet.');
    });
  });

  describe('petal geometry', () => {
    const shares = (values: (number | null)[]) => values.map((share, index) => ({ code: `N${index}`, symbol: `S${index}`, share }));

    it('gives one petal per nutrient', () => {
      expect(petalGeometry(shares([0.5, 1, 1.5]), 290).petals.length).toBe(3);
      expect(petalGeometry([], 290).petals).toEqual([]);
    });

    it('ends a petal at the dashed ring at 100%', () => {
      const geometry = petalGeometry(shares([1]), 290);
      expect(geometry.petals[0].radius).toBeCloseTo(geometry.ringRadius);
    });

    it('measures a petal from the inner circle by its share', () => {
      const geometry = petalGeometry(shares([0, 0.5]), 290);
      expect(geometry.petals[0].radius).toBeCloseTo(geometry.innerRadius);
      expect(geometry.petals[1].radius).toBeCloseTo(geometry.innerRadius + (geometry.ringRadius - geometry.innerRadius) * 0.5);
    });

    it('caps a petal at 200%', () => {
      const geometry = petalGeometry(shares([2, 5]), 290);
      expect(PETAL_CAP).toBe(2);
      expect(geometry.petals[1].radius).toBeCloseTo(geometry.petals[0].radius);
      expect(geometry.petals[1].radius).toBeLessThanOrEqual(290 * 0.44 + 0.001);
    });

    it('draws no petal for an unknown nutrient but keeps its slot and label', () => {
      const geometry = petalGeometry(shares([null, 1]), 290);
      expect(geometry.petals[0].path).toBe('');
      expect(geometry.petals[0].symbol).toBe('S0');
      expect(geometry.petals[1].path).toContain('M');
    });

    it('marks reached petals and starts the first at the top', () => {
      const geometry = petalGeometry(shares([0.99, 1]), 290);
      expect(geometry.petals.map((petal) => petal.reached)).toEqual([false, true]);
      const top = petalGeometry(shares([1, 1, 1, 1]), 290).petals[0];
      expect(top.labelY).toBeLessThan(290 / 2);
    });
  });

  describe('day bars', () => {
    const days = [day('2026-10-01', 0.5), day('2026-10-02', null), day('2026-10-03', 1), day('2026-10-04', 3)];

    it('is empty for a day that was not logged and capped for a very high one', () => {
      const bars = dayBars(days);
      expect(bars[0].height).toBeCloseTo((0.5 / BAR_TOP) * 100);
      expect(bars[1]).toEqual(jasmine.objectContaining({ height: 0, logged: false, reached: false }));
      expect(bars[2].reached).toBeTrue();
      expect(bars[3].height).toBe(100);
    });

    it('has a text summary', () => {
      expect(dayBarsSummary('Vitamin D', days)).toBe('Vitamin D each day: logged on 3 of 4 days, daily amount reached on 2.');
    });
  });
});
