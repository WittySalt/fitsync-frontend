import { FOOD_GROUPS, asFoodGroup, foodGroupInfo, groupColour, groupForCategory, iconFor } from './food-groups';
import { GLYPHS } from './food-glyphs';

describe('food groups', () => {
  it('reads a backend group in any case and rejects OTHER and unknown words', () => {
    expect(asFoodGroup('veg')).toBe('VEG');
    expect(asFoodGroup('DRINKS')).toBe('DRINKS');
    expect(asFoodGroup('OTHER')).toBeNull();
    expect(asFoodGroup(null)).toBeNull();
  });

  it('gives each group a colour token and a drawn icon', () => {
    for (const group of FOOD_GROUPS) {
      expect(group.colour).toBe(`var(--food-${group.key.toLowerCase()})`);
      expect(GLYPHS[group.icon].length).toBeGreaterThan(0);
    }
  });

  it('uses a neutral colour for no group', () => {
    expect(groupColour(null)).toBe('var(--text-secondary)');
    expect(groupColour('FRUIT')).toBe('var(--food-fruit)');
    expect(foodGroupInfo(null)).toBeNull();
  });

  it('maps a category to its group as the backend does', () => {
    expect(groupForCategory('MEAT_POULTRY')).toBe('PROTEIN');
    expect(groupForCategory('fats_oils')).toBe('NUTS');
    expect(groupForCategory('BEVERAGES')).toBe('DRINKS');
    expect(groupForCategory('SPICES')).toBeNull();
    expect(groupForCategory(undefined)).toBeNull();
  });

  it('gives fish and eggs their own drawing and every other food its group icon', () => {
    expect(iconFor('PROTEIN', 'SEAFOOD')).toBe('FISH');
    expect(iconFor('PROTEIN', 'EGGS')).toBe('EGG');
    expect(iconFor('PROTEIN', 'MEAT_POULTRY')).toBe('PROTEIN');
    expect(iconFor(null)).toBeNull();
  });
});
