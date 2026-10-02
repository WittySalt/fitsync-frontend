import { mapNutrientDetail, mapNutrientGuide, mapNutrientTile, mapNutrientsOverview } from './nutrients-mappers';

describe('nutrient mappers', () => {
  const wire = {
    code: 'VITAMIN_D',
    displayName: 'Vitamin D',
    unit: 'µg',
    groupCode: 'FAT_SOLUBLE',
    symbol: 'D',
    atomicNumber: null,
    averageAmount: 5.1,
    reference: 15,
    share: 0.34,
    met: false,
    days: [{ date: '2026-10-02', logged: true, amount: 7.5, share: 0.5 }]
  };

  it('maps a summary row with its group, symbol and days', () => {
    const tile = mapNutrientTile(wire);
    expect(tile).toEqual(jasmine.objectContaining({ code: 'VITAMIN_D', groupCode: 'FAT_SOLUBLE', symbol: 'D', share: 0.34, atomicNumber: null }));
    expect(tile?.dayValues).toEqual([{ date: '2026-10-02', logged: true, amount: 7.5, share: 0.5 }]);
  });

  it('treats a missing average as unknown, not zero', () => {
    const tile = mapNutrientTile({ ...wire, averageAmount: null, share: null });
    expect(tile?.averageAmount).toBeNull();
    expect(tile?.share).toBeNull();
  });

  it('works the share out from the average when the server leaves it out', () => {
    expect(mapNutrientTile({ ...wire, share: undefined })?.share).toBeCloseTo(5.1 / 15);
  });

  it('drops a row with no code or no daily amount', () => {
    expect(mapNutrientTile({ ...wire, code: '' })).toBeNull();
    expect(mapNutrientTile({ ...wire, reference: 0 })).toBeNull();
    expect(mapNutrientTile({ ...wire, reference: null })).toBeNull();
  });

  it('places a row without a group code by its kind', () => {
    const noGroup = { ...wire, groupCode: undefined };
    expect(mapNutrientTile({ ...noGroup, kind: 'VITAMIN' })?.groupCode).toBe('WATER_SOLUBLE');
    expect(mapNutrientTile({ ...noGroup, kind: 'MINERAL' })?.groupCode).toBe('MAJOR_MINERAL');
    expect(mapNutrientTile({ ...noGroup, kind: 'LIMIT' })?.groupCode).toBe('LIMIT');
  });

  it('reads an overview and survives an empty answer', () => {
    expect(mapNutrientsOverview({ daysLogged: 4, referenceLabel: 'Male ranges', nutrients: [wire, { nope: true }] })).toEqual(
      jasmine.objectContaining({ daysLogged: 4, referenceLabel: 'Male ranges' })
    );
    expect(mapNutrientsOverview({ nutrients: [wire, { nope: true }] }).nutrients.length).toBe(1);
    expect(mapNutrientsOverview({})).toEqual({ daysLogged: 0, referenceLabel: null, nutrients: [] });
  });

  it('reads a detail with sources, ages, richest foods and the guide', () => {
    const mapped = mapNutrientDetail({
      ...wire,
      days: 7,
      dayValues: [{ date: '2026-10-02', logged: true, amount: 7.5 }],
      referenceLabel: 'Male ranges, aged 19 to 30',
      sources: [{ name: 'Salmon', foodGroup: 'PROTEIN', categoryCode: 'FISH', amount: 2.6, share: 0.51 }, { share: 1 }],
      amounts: [{ ageBand: '19-50', label: '19 to 50', female: 15, male: 15, upperLimit: 100, mine: true }],
      richest: [{ foodCatalogItemId: 'f1', name: 'Trout', foodGroup: 'PROTEIN', categoryCode: 'FISH', amountPer100g: 16 }],
      guide: { whatItDoes: 'Helps bones.', tips: ['Eat fish', 5], sourceLabel: 'NIH' }
    });
    expect(mapped?.days).toBe(7);
    expect(mapped?.tile.dayValues[0].share).toBeCloseTo(0.5);
    expect(mapped?.sources.length).toBe(1);
    expect(mapped?.sources[0].foodGroup).toBe('PROTEIN');
    expect(mapped?.amounts[0].mine).toBeTrue();
    expect(mapped?.richest[0].foodId).toBe('f1');
    expect(mapped?.guide?.tips).toEqual(['Eat fish']);
  });

  it('gives a null guide when the server sends none or an empty one', () => {
    expect(mapNutrientDetail({ ...wire, guide: null })?.guide).toBeNull();
    expect(mapNutrientDetail({ ...wire })?.guide).toBeNull();
    expect(mapNutrientGuide({ tips: [] })).toBeNull();
    expect(mapNutrientGuide('x')).toBeNull();
  });

  it('gives no detail for an answer that cannot be measured', () => {
    expect(mapNutrientDetail({})).toBeNull();
  });
});
