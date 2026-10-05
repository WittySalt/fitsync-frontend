/** The food groups the Diary draws, in the order the plate lists them. */
export type FoodGroup = 'VEG' | 'FRUIT' | 'GRAINS' | 'PROTEIN' | 'DAIRY' | 'NUTS' | 'LEGUMES' | 'DRINKS' | 'SWEETS';

export interface FoodGroupInfo {
  key: FoodGroup;
  /** The name in a legend. */
  label: string;
  /** The short name under a badge. */
  shortName: string;
  /** The icon drawn on the tile and in the plate. */
  icon: string;
  /** The CSS custom property that holds the group's colour (light and dark values live in the tokens). */
  colour: string;
}

export const FOOD_GROUPS: readonly FoodGroupInfo[] = [
  { key: 'VEG', label: 'Vegetables', shortName: 'Veg', icon: 'VEG', colour: 'var(--food-veg)' },
  { key: 'FRUIT', label: 'Fruit', shortName: 'Fruit', icon: 'FRUIT', colour: 'var(--food-fruit)' },
  { key: 'GRAINS', label: 'Grains', shortName: 'Grains', icon: 'GRAINS', colour: 'var(--food-grains)' },
  { key: 'PROTEIN', label: 'Protein', shortName: 'Protein', icon: 'PROTEIN', colour: 'var(--food-protein)' },
  { key: 'DAIRY', label: 'Dairy', shortName: 'Dairy', icon: 'DAIRY', colour: 'var(--food-dairy)' },
  { key: 'NUTS', label: 'Nuts and oils', shortName: 'Nuts', icon: 'NUTS', colour: 'var(--food-nuts)' },
  { key: 'LEGUMES', label: 'Legumes', shortName: 'Beans', icon: 'LEGUMES', colour: 'var(--food-legumes)' },
  { key: 'DRINKS', label: 'Drinks', shortName: 'Drinks', icon: 'DRINKS', colour: 'var(--food-drinks)' },
  { key: 'SWEETS', label: 'Sweets and snacks', shortName: 'Sweets', icon: 'SWEETS', colour: 'var(--food-sweets)' }
];

/** The colour used for a food that belongs to no group, so a tile is never left without one. */
export const NEUTRAL_FOOD_COLOUR = 'var(--text-secondary)';

/** The group a backend value names, or null for OTHER, an unknown word or nothing. */
export function asFoodGroup(value: string | null | undefined): FoodGroup | null {
  const key = (value ?? '').toUpperCase();
  return FOOD_GROUPS.some((group) => group.key === key) ? (key as FoodGroup) : null;
}

export function foodGroupInfo(group: FoodGroup | null | undefined): FoodGroupInfo | null {
  return FOOD_GROUPS.find((entry) => entry.key === group) ?? null;
}

/** Spices are not a plate group (the backend files them under OTHER), so they have a colour and a drawing of their own. */
const SEASONING_CATEGORIES: ReadonlySet<string> = new Set(['SPICES']);

export function isSeasoning(categoryCode: string | null | undefined): boolean {
  return SEASONING_CATEGORIES.has((categoryCode ?? '').toUpperCase());
}

export function groupColour(group: FoodGroup | null | undefined, categoryCode?: string | null): string {
  if (!group && isSeasoning(categoryCode)) {
    return 'var(--food-spice)';
  }
  return foodGroupInfo(group)?.colour ?? NEUTRAL_FOOD_COLOUR;
}

/** Which group a food category belongs to, the same table the backend keeps (API contract, section 2). */
const CATEGORY_GROUP: Record<string, FoodGroup> = {
  VEGETABLES: 'VEG',
  FRUITS: 'FRUIT',
  GRAINS: 'GRAINS',
  MEAT_POULTRY: 'PROTEIN',
  SEAFOOD: 'PROTEIN',
  EGGS: 'PROTEIN',
  PLANT_PROTEIN: 'PROTEIN',
  PROTEIN_SUPPLEMENT: 'PROTEIN',
  DAIRY: 'DAIRY',
  NUTS_SEEDS: 'NUTS',
  FATS_OILS: 'NUTS',
  LEGUMES: 'LEGUMES',
  BEVERAGES: 'DRINKS',
  SWEETS: 'SWEETS',
  SNACKS: 'SWEETS'
};

export function groupForCategory(categoryCode: string | null | undefined): FoodGroup | null {
  return CATEGORY_GROUP[(categoryCode ?? '').toUpperCase()] ?? null;
}

/**
 * The icon for a food: fish and eggs have their own drawing, everything else uses its group's.
 * A food with no group (prepared and restaurant food, for one) gets the plate and fork.
 */
export function iconFor(group: FoodGroup | null | undefined, categoryCode?: string | null): string {
  const category = (categoryCode ?? '').toUpperCase();
  if (!group && isSeasoning(category)) {
    return 'SHAKER';
  }
  if (category === 'SEAFOOD') {
    return 'FISH';
  }
  if (category === 'EGGS') {
    return 'EGG';
  }
  return foodGroupInfo(group)?.icon ?? 'PLATE';
}
