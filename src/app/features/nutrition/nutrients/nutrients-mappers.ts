import { asFoodGroup } from '../../../shared/food/food-groups';
import { list, num, text } from '../diary/diary-mappers';
import {
  AgeBandAmount,
  NutrientDayValue,
  NutrientDetail,
  NutrientGroup,
  NutrientGuide,
  NutrientSource,
  NutrientTileData,
  NutrientsOverview,
  RichFood
} from './nutrients.models';

type Wire = Record<string, unknown>;

const GROUPS: readonly NutrientGroup[] = ['FAT_SOLUBLE', 'WATER_SOLUBLE', 'MAJOR_MINERAL', 'TRACE_MINERAL', 'LIMIT'];

/**
 * The group of a row, or null for a nutrient the table does not show. The server sends no group
 * code for fibre, cholesterol, alcohol and caffeine, so those are left out here rather than guessed
 * into a group.
 */
function groupOf(raw: Wire): NutrientGroup | null {
  const code = text(raw['groupCode']);
  return GROUPS.find((group) => group === code) ?? null;
}

function mapDay(raw: Wire, reference: number): NutrientDayValue | null {
  const date = text(raw['date']);
  if (!date) {
    return null;
  }
  const amount = num(raw['amount']);
  return {
    date,
    logged: raw['logged'] === true,
    amount,
    share: amount === null ? null : (num(raw['share']) ?? amount / reference)
  };
}

export function mapNutrientTile(raw: Wire): NutrientTileData | null {
  const code = text(raw['code']);
  const reference = num(raw['reference']);
  const groupCode = groupOf(raw);
  if (!code || reference === null || reference <= 0 || groupCode === null) {
    return null;
  }
  const average = num(raw['averageAmount']);
  const name = text(raw['displayName']) ?? code;
  return {
    code,
    displayName: name,
    unit: text(raw['unit']) ?? '',
    groupCode,
    symbol: text(raw['symbol']) ?? name.slice(0, 2),
    atomicNumber: num(raw['atomicNumber']),
    averageAmount: average,
    reference,
    share: average === null ? null : (num(raw['share']) ?? average / reference),
    met: raw['met'] === true,
    upperLimit: num(raw['upperLimit']),
    aboveUpperLimit: raw['aboveUpperLimit'] === true,
    dayValues: list(raw['dayValues'] ?? raw['days'])
      .map((day) => mapDay(day, reference))
      .filter((day): day is NutrientDayValue => day !== null)
  };
}

export function mapNutrientsOverview(raw: Wire): NutrientsOverview {
  return {
    daysLogged: num(raw['daysLogged']) ?? 0,
    referenceLabel: text(raw['referenceLabel']),
    nutrients: list(raw['nutrients']).map(mapNutrientTile).filter((row): row is NutrientTileData => row !== null)
  };
}

function mapSource(raw: Wire): NutrientSource | null {
  const name = text(raw['name']);
  return name
    ? {
        name,
        foodGroup: asFoodGroup(text(raw['foodGroup'])),
        categoryCode: text(raw['categoryCode']),
        amount: num(raw['amount']),
        share: num(raw['share'])
      }
    : null;
}

function mapAmount(raw: Wire): AgeBandAmount | null {
  const label = text(raw['label']) ?? text(raw['ageBand']);
  return label
    ? {
        ageBand: text(raw['ageBand']) ?? label,
        label,
        female: num(raw['female']),
        male: num(raw['male']),
        upperLimit: num(raw['upperLimit']),
        mine: raw['mine'] === true
      }
    : null;
}

function mapRich(raw: Wire): RichFood | null {
  const name = text(raw['name']);
  return name
    ? {
        foodId: text(raw['foodCatalogItemId']) ?? name,
        name,
        foodGroup: asFoodGroup(text(raw['foodGroup'])),
        categoryCode: text(raw['categoryCode']),
        amountPer100g: num(raw['amountPer100g'])
      }
    : null;
}

/** The guide, or null when the server sends none or sends nothing readable in it. */
export function mapNutrientGuide(raw: unknown): NutrientGuide | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const wire = raw as Wire;
  const guide: NutrientGuide = {
    whatItDoes: text(wire['whatItDoes']),
    tooLittleTooMuch: text(wire['tooLittleTooMuch']),
    whoNeedsMore: text(wire['whoNeedsMore']),
    tips: Array.isArray(wire['tips']) ? wire['tips'].filter((tip): tip is string => typeof tip === 'string' && tip.trim() !== '') : [],
    sourceLabel: text(wire['sourceLabel'])
  };
  const empty = !guide.whatItDoes && !guide.tooLittleTooMuch && !guide.whoNeedsMore && guide.tips.length === 0;
  return empty ? null : guide;
}

/** The detail answer of a nutrient, or null when it has no code, no group or no daily amount to measure against. */
export function mapNutrientDetail(raw: Wire): NutrientDetail | null {
  const tile = mapNutrientTile(raw);
  if (!tile) {
    return null;
  }
  return {
    tile,
    from: text(raw['from']) ?? '',
    to: text(raw['to']) ?? '',
    days: num(raw['days']) ?? 0,
    daysLogged: num(raw['daysLogged']) ?? 0,
    referenceLabel: text(raw['referenceLabel']),
    sources: list(raw['sources']).map(mapSource).filter((s): s is NutrientSource => s !== null),
    amounts: list(raw['amounts']).map(mapAmount).filter((a): a is AgeBandAmount => a !== null),
    richest: list(raw['richest']).map(mapRich).filter((r): r is RichFood => r !== null),
    guide: mapNutrientGuide(raw['guide'])
  };
}
