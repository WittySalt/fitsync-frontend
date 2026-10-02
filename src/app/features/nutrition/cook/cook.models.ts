import { FoodGroup, asFoodGroup } from '../../../shared/food/food-groups';

/** A time written in a step: `seconds` is the lower end of a range and `maxSeconds` the upper end. */
export interface CookTimerDef {
  seconds: number;
  maxSeconds: number | null;
  eachSide: boolean;
  /** The text as written in the step, so the page can colour it. */
  phrase: string;
}

export interface CookIngredient {
  id: string;
  name: string;
  displayText: string;
  grams: number | null;
  foodGroup: FoodGroup | null;
  categoryCode: string | null;
}

export interface CookStep {
  number: number;
  text: string;
  title: string;
  ingredientIds: string[];
  timer: CookTimerDef | null;
}

export interface CookRecipe {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Calories in one serving, or null when the server sent none. */
  kcalPerServing: number | null;
  /** How many times it was cooked before this cook, 0 when the server sends none. */
  cookCount: number;
  servings: number;
  ingredients: CookIngredient[];
  steps: CookStep[];
}

type Wire = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function positive(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function list(value: unknown): Wire[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as Wire[]) : [];
}

/** The first sentence of a step, cut at a comma or a space when it is longer than 60 characters. */
export function titleFromText(stepText: string): string {
  const clean = stepText.replace(/\s+/g, ' ').trim();
  const match = /^.*?[.!?](?=\s|$)/.exec(clean);
  const sentence = match ? match[0] : clean;
  if (sentence.length <= 60) {
    return sentence;
  }
  const head = sentence.slice(0, 60);
  const comma = head.lastIndexOf(',');
  if (comma >= 20) {
    return head.slice(0, comma);
  }
  const space = head.lastIndexOf(' ');
  return (space > 0 ? head.slice(0, space) : head).trim();
}

function mapTimer(wire: Wire | undefined): CookTimerDef | null {
  const seconds = positive(wire?.['seconds']);
  if (!wire || seconds === null) {
    return null;
  }
  const max = positive(wire['maxSeconds']);
  return {
    seconds,
    maxSeconds: max !== null && max > seconds ? max : null,
    eachSide: wire['eachSide'] === true,
    phrase: text(wire['phrase'])
  };
}

/** Reads the recipe detail; a step without title, ingredientIds or timers still works. */
export function mapCookRecipe(wire: Wire): CookRecipe {
  const ingredients = list(wire['ingredients']).map((item): CookIngredient => {
    const name = text(item['name']) || text(item['foodName']) || text(item['displayText']);
    return {
      id: String(item['ingredientId'] ?? ''),
      name,
      displayText: text(item['displayText']) || name,
      // 0 g stays 0, so the page can say "to taste"; a missing weight is still null.
      grams: Number(item['grams']) === 0 && item['grams'] !== null && item['grams'] !== '' ? 0 : positive(item['grams']),
      foodGroup: asFoodGroup(text(item['foodGroup'])),
      categoryCode: text(item['categoryCode']) || null
    };
  });
  const steps = list(wire['steps'])
    .map((item, index) => ({ item, order: positive(item['stepNumber']) ?? index + 1 }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }, index): CookStep => {
      const body = text(item['text']);
      const ids = Array.isArray(item['ingredientIds']) ? (item['ingredientIds'] as unknown[]).map(String) : [];
      return {
        number: index + 1,
        text: body,
        title: text(item['title']) || titleFromText(body),
        ingredientIds: ids,
        timer: mapTimer(list(item['timers'])[0])
      };
    });
  return {
    id: String(wire['id'] ?? ''),
    name: text(wire['name']),
    imageUrl: text(wire['imageUrl']) || null,
    kcalPerServing: positive((wire['perServing'] as Wire | null | undefined)?.['kcal']),
    cookCount: Math.max(0, Math.round(Number(wire['cookCount']) || 0)),
    servings: positive(wire['servings']) ?? 1,
    ingredients,
    steps
  };
}
