import { RecipeSuggestions } from './recipes.models';

/** The question the folded card sends to the coach. */
export const TOMORROW_QUESTION = 'What should I cook tomorrow?';
/** What the Ask pill puts in the composer. Nothing is sent until the person sends it. */
export const COOK_CARD_PREFILL = 'Why these recipes for tonight?';
export const SUGGESTIONS_ERROR = 'Suggestions are not available right now.';

const MOST_COOKED_REASON = 'Your most cooked';

function kcal(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** The folded row once dinner is logged: "Dinner logged · 2,010 of 2,100 kcal". */
export function dinnerLine(data: RecipeSuggestions): string {
  const { eatenKcal, targetKcal } = data.facts;
  return eatenKcal !== null && targetKcal !== null ? `Dinner logged · ${kcal(eatenKcal)} of ${kcal(targetKcal)} kcal` : 'Dinner logged';
}

/** The serif line of the card, by state (spec section 2). Never an arrow, never a scolding. */
export function cookHeadline(data: RecipeSuggestions): string {
  const { eatenKcal, targetKcal } = data.facts;
  switch (data.state) {
    case 'PROTEIN_ONLY':
      return 'Protein is the one thing short today.';
    case 'NOTHING_LOGGED':
      return 'Nothing logged today yet.';
    case 'PAST_TARGET':
      return "You're past today's target, a light option if you still cook.";
    case 'DINNER_LOGGED':
      return dinnerLine(data);
    default:
      return eatenKcal !== null && targetKcal !== null && targetKcal > 0 && eatenKcal < targetKcal / 2
        ? 'Light day so far, dinner can be the big one tonight.'
        : 'Room for a proper dinner tonight.';
  }
}

function proteinShort(grams: number | null): string | null {
  return grams !== null && grams > 0 ? `protein ${Math.round(grams)} g short` : null;
}

/** The facts line as chips. A fact the server left out is left out here. */
export function cookChips(data: RecipeSuggestions): string[] {
  const { kcalLeft, proteinShortGrams, lowestNutrient, usualDinnerTime, eatenKcal, targetKcal, proteinMet } = data.facts;
  const chips: (string | null)[] = [];
  switch (data.state) {
    case 'NOTHING_LOGGED':
      chips.push(usualDinnerTime ? `You usually eat dinner at ${usualDinnerTime}` : null);
      chips.push(data.suggestions[0]?.reason.startsWith(MOST_COOKED_REASON) ? 'your most cooked this month' : null);
      break;
    case 'PAST_TARGET':
      chips.push(eatenKcal !== null && targetKcal !== null ? `${kcal(eatenKcal)} of ${kcal(targetKcal)} kcal` : null);
      chips.push(proteinMet ? 'protein met' : proteinShort(proteinShortGrams));
      break;
    case 'PROTEIN_ONLY':
      chips.push(proteinShort(proteinShortGrams));
      chips.push(kcalLeft !== null ? `${kcal(kcalLeft)} kcal left` : null);
      break;
    case 'FITS':
      chips.push(kcalLeft !== null ? `${kcal(kcalLeft)} kcal left` : null);
      chips.push(proteinShort(proteinShortGrams));
      chips.push(lowestNutrient ? `${lowestNutrient} lowest this week` : null);
      chips.push(usualDinnerTime ? `you usually eat at ${usualDinnerTime}` : null);
      break;
    default:
      break;
  }
  return chips.filter((chip): chip is string => chip !== null);
}
