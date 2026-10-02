import { NutrientDayValue, NutrientDetail, NutrientGroup, NutrientTileData, NutrientsOverview } from './nutrients.models';

/** A tile with sensible defaults, for specs. */
export function tile(overrides: Partial<NutrientTileData> = {}): NutrientTileData {
  const share = overrides.share === undefined ? 0.34 : overrides.share;
  return {
    code: 'VIT_D',
    displayName: 'Vitamin D',
    unit: 'µg',
    groupCode: 'FAT_SOLUBLE',
    symbol: 'D',
    atomicNumber: null,
    averageAmount: share === null ? null : share * 15,
    reference: 15,
    share,
    met: (share ?? 0) >= 1,
    upperLimit: null,
    aboveUpperLimit: false,
    dayValues: [],
    ...overrides
  };
}

export const day = (date: string, share: number | null): NutrientDayValue => ({
  date,
  logged: share !== null,
  amount: share === null ? null : share * 15,
  share
});

const make = (code: string, name: string, symbol: string, group: NutrientGroup, share: number | null, atomic: number | null = null) =>
  tile({ code, displayName: name, symbol, groupCode: group, share, atomicNumber: atomic });

/** One nutrient of each kind, in table order. */
export function nutrients(): NutrientTileData[] {
  return [
    make('VIT_D', 'Vitamin D', 'D', 'FAT_SOLUBLE', 0.34),
    make('VIT_E', 'Vitamin E', 'E', 'FAT_SOLUBLE', 0.61),
    make('VIT_C', 'Vitamin C', 'C', 'WATER_SOLUBLE', 1.04),
    make('POTASSIUM', 'Potassium', 'K', 'MAJOR_MINERAL', 0.62, 19),
    make('IRON', 'Iron', 'Fe', 'TRACE_MINERAL', 1.88, 26),
    make('ZINC', 'Zinc', 'Zn', 'TRACE_MINERAL', null, 30),
    make('SODIUM', 'Sodium', 'Na', 'LIMIT', 1.15)
  ];
}

export function overview(data: NutrientTileData[] = nutrients(), overrides: Partial<NutrientsOverview> = {}): NutrientsOverview {
  return { daysLogged: 5, referenceLabel: 'Male ranges, aged 19 to 30', nutrients: data, ...overrides };
}

export function detail(overrides: Partial<NutrientDetail> = {}): NutrientDetail {
  return {
    tile: tile({ dayValues: [day('2026-09-30', 0.3), day('2026-10-01', null), day('2026-10-02', 1.1)] }),
    from: '2026-09-26',
    to: '2026-10-02',
    days: 7,
    daysLogged: 2,
    referenceLabel: 'Male ranges, aged 19 to 30',
    sources: [{ name: 'Salmon', foodGroup: 'PROTEIN', categoryCode: 'FISH', amount: 2.6, share: 0.51 }],
    amounts: [
      { ageBand: '14-18', label: '14 to 18', female: 15, male: 15, upperLimit: 100, mine: false },
      { ageBand: '19-50', label: '19 to 50', female: 15, male: 15, upperLimit: 100, mine: true }
    ],
    richest: [{ foodId: 'f1', name: 'Rainbow trout', foodGroup: 'PROTEIN', categoryCode: 'FISH', amountPer100g: 16 }],
    guide: {
      whatItDoes: 'Helps the body take up calcium.',
      tooLittleTooMuch: 'Low levels over months can soften bones.',
      whoNeedsMore: 'People over 70.',
      tips: ['It dissolves in fat.'],
      sourceLabel: 'NIH Office of Dietary Supplements'
    },
    ...overrides
  };
}
