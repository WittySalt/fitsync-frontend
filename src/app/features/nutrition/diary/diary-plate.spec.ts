import { badgeNote, fruitVegSentence, groupBadges, plateLegend, plateTotals, plateWedges } from './diary-plate';
import { item } from './diary-testing';

const veg = item({ foodGroup: 'VEG', gramsConsumed: 50 });
const fruit = item({ foodGroup: 'FRUIT', gramsConsumed: 300 });
const grains = item({ foodGroup: 'GRAINS', gramsConsumed: 250 });

describe('plateTotals', () => {
  it('adds grams by group', () => {
    const totals = plateTotals([veg, fruit, grains, item({ foodGroup: 'FRUIT', gramsConsumed: 100 })]);
    expect(totals.grams.FRUIT).toBe(400);
    expect(totals.totalGrams).toBe(700);
    expect(totals.leftOut).toBe(0);
  });

  it('leaves drinks off the plate without counting them as left out', () => {
    const totals = plateTotals([veg, item({ foodGroup: 'DRINKS', gramsConsumed: 250 })]);
    expect(totals.totalGrams).toBe(50);
    expect(totals.leftOut).toBe(0);
  });

  it('counts foods with no weight or no group as left out', () => {
    const totals = plateTotals([veg, item({ gramsConsumed: null }), item({ foodGroup: null, gramsConsumed: 80 }), item({ gramsConsumed: 0 })]);
    expect(totals.totalGrams).toBe(50);
    expect(totals.leftOut).toBe(3);
  });
});

describe('plateWedges', () => {
  it('has no wedges for an empty plate', () => {
    expect(plateWedges(plateTotals([]), 200)).toEqual([]);
  });

  it('starts at the top with veg then fruit, and the sweeps add up to a full turn', () => {
    const wedges = plateWedges(plateTotals([grains, fruit, veg]), 200);
    expect(wedges.map((wedge) => wedge.group)).toEqual(['VEG', 'FRUIT', 'GRAINS']);
    expect(wedges.reduce((sum, wedge) => sum + wedge.sweep, 0)).toBeCloseTo(360);
    expect(wedges[0].path).toContain('M100,100 L100.00,26.00');
  });

  it('gives an icon only to a wedge of at least 30 degrees', () => {
    const wedges = plateWedges(plateTotals([item({ foodGroup: 'VEG', gramsConsumed: 40 }), item({ foodGroup: 'GRAINS', gramsConsumed: 960 })]), 200);
    expect(wedges[0].sweep).toBeCloseTo(14.4);
    expect(wedges[0].showIcon).toBeFalse();
    expect(wedges[1].showIcon).toBeTrue();
  });

  it('draws one group alone as a full circle, not a path', () => {
    const wedges = plateWedges(plateTotals([grains]), 200);
    expect(wedges.length).toBe(1);
    expect(wedges[0].path).toBeNull();
  });

  it('marks a sweep over half a turn as a large arc', () => {
    const wedges = plateWedges(plateTotals([item({ foodGroup: 'GRAINS', gramsConsumed: 800 }), veg]), 200);
    const big = wedges.find((wedge) => wedge.group === 'GRAINS');
    expect(big?.path).toContain(' 0 1 1 ');
  });
});

describe('plateLegend', () => {
  it('lists only the groups on the plate, with whole percentages, in the usual group order', () => {
    const legend = plateLegend(plateWedges(plateTotals([grains, fruit, veg]), 200));
    expect(legend.map((entry) => entry.label)).toEqual(['Vegetables', 'Fruit', 'Grains']);
    expect(legend.map((entry) => entry.percent)).toEqual([8, 50, 42]);
  });
});

describe('fruitVegSentence', () => {
  it('is empty when nothing was weighed', () => {
    expect(fruitVegSentence(plateTotals([]))).toBe('');
  });

  it('compares a smaller share with half', () => {
    expect(fruitVegSentence(plateTotals([veg, fruit, grains, grains]))).toBe(
      'Fruit and veg were about 41% of what you ate, against the half on a balanced plate.'
    );
  });

  it('says so when half is reached', () => {
    expect(fruitVegSentence(plateTotals([fruit, veg, item({ foodGroup: 'PROTEIN', gramsConsumed: 300 })]))).toContain('which matches the half');
  });

  it('says there was none', () => {
    expect(fruitVegSentence(plateTotals([grains]))).toBe('There was no fruit or veg by weight, against the half on a balanced plate.');
  });
});

describe('groupBadges and badgeNote', () => {
  it('marks the groups eaten and counts a food even without a weight', () => {
    const badges = groupBadges([veg, item({ foodGroup: 'LEGUMES', gramsConsumed: null })]);
    expect(badges.map((badge) => badge.name)).toEqual(['Veg', 'Fruit', 'Grains', 'Protein', 'Dairy', 'Nuts', 'Beans']);
    expect(badges.filter((badge) => badge.eaten).map((badge) => badge.name)).toEqual(['Veg', 'Beans']);
  });

  it('names the one missing group, and says all seven when none is missing', () => {
    const all = ['VEG', 'FRUIT', 'GRAINS', 'PROTEIN', 'DAIRY', 'NUTS', 'LEGUMES'] as const;
    expect(badgeNote(groupBadges(all.map((group) => item({ foodGroup: group }))))).toBe('All seven');
    expect(badgeNote(groupBadges(all.filter((group) => group !== 'LEGUMES').map((group) => item({ foodGroup: group }))))).toBe('No beans yet');
    expect(badgeNote(groupBadges([veg]))).toBe('');
  });
});
