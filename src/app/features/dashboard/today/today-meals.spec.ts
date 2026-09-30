import { DayMeal } from '../../../core/fitsync.models';
import {
  budgetFigure,
  defaultMealSlot,
  fillPercent,
  macroEnergyShares,
  percentOfTarget,
  slotForMealType,
  summariseSlots,
  wholeNumber
} from './today-meals';

function meal(mealType: string, hour: number, calories: number, extra: Partial<DayMeal> = {}): DayMeal {
  return {
    mealId: `${mealType}-${hour}`,
    mealType,
    consumedAt: new Date(2026, 8, 30, hour, 0).toISOString(),
    totalCalories: calories,
    totalProteinGrams: 10,
    totalCarbsGrams: 20,
    totalFatGrams: 5,
    items: [],
    ...extra
  };
}

function at(hour: number, minute = 0): Date {
  return new Date(2026, 8, 30, hour, minute);
}

describe('default meal slot', () => {
  it('opens the slot of the latest meal logged today', () => {
    const meals = [meal('BREAKFAST', 8, 400), meal('LUNCH', 13, 600)];

    expect(defaultMealSlot(meals, at(7, 0))).toBe('LUNCH');
  });

  it('follows the latest meal by time, not by the order of the list', () => {
    const meals = [meal('DINNER', 19, 700), meal('BREAKFAST', 8, 400)];

    expect(defaultMealSlot(meals, at(20))).toBe('DINNER');
  });

  it('opens a snack when a snack was the latest meal logged', () => {
    expect(defaultMealSlot([meal('BREAKFAST', 8, 400), meal('SNACK', 16, 200)], at(9))).toBe('SNACK');
  });

  it('uses the usual window when nothing is logged', () => {
    expect(defaultMealSlot([], at(6, 30))).toBe('BREAKFAST');
    expect(defaultMealSlot([], at(9, 0))).toBe('BREAKFAST');
    expect(defaultMealSlot([], at(11, 30))).toBe('LUNCH');
    expect(defaultMealSlot([], at(14, 0))).toBe('LUNCH');
    expect(defaultMealSlot([], at(18, 0))).toBe('DINNER');
    expect(defaultMealSlot([], at(20, 30))).toBe('DINNER');
  });

  it('opens breakfast outside every window and never picks a snack by itself', () => {
    expect(defaultMealSlot([], at(16, 0))).toBe('BREAKFAST');
    expect(defaultMealSlot([], at(23, 0))).toBe('BREAKFAST');
    expect(defaultMealSlot([], at(3, 0))).toBe('BREAKFAST');
  });

  it('opens a window from an hour before to ninety minutes after, both ends included', () => {
    expect(defaultMealSlot([], at(11, 29))).toBe('BREAKFAST');
    expect(defaultMealSlot([], at(11, 30))).toBe('LUNCH');
    expect(defaultMealSlot([], at(14, 0))).toBe('LUNCH');
    expect(defaultMealSlot([], at(14, 1))).toBe('BREAKFAST');
  });

  it('still opens a slot when the latest meal has no readable time', () => {
    const unreadable = meal('DINNER', 19, 700, { consumedAt: 'garbled' });

    expect(defaultMealSlot([unreadable], at(8))).toBe('DINNER');
  });
});

describe('slot summaries', () => {
  it('sums several meals of one type and lists their foods together', () => {
    const first = meal('LUNCH', 12, 400, {
      totalProteinGrams: 30,
      items: [{ name: 'Rice', calories: 250, proteinGrams: 5 }]
    });
    const second = meal('LUNCH', 15, 150, {
      totalProteinGrams: 8,
      items: [{ name: 'Apple', calories: 95, proteinGrams: 0 }]
    });

    const lunch = summariseSlots([first, second]).LUNCH;

    expect(lunch.logged).toBeTrue();
    expect(lunch.calories).toBe(550);
    expect(lunch.proteinGrams).toBe(38);
    expect(lunch.carbsGrams).toBe(40);
    expect(lunch.fatGrams).toBe(10);
    expect(lunch.foods.map((food) => food.name)).toEqual(['Rice', 'Apple']);
  });

  it('marks slots without a meal as not logged', () => {
    const summaries = summariseSlots([meal('BREAKFAST', 8, 400)]);

    expect(summaries.BREAKFAST.logged).toBeTrue();
    expect(summaries.LUNCH.logged).toBeFalse();
    expect(summaries.DINNER.logged).toBeFalse();
    expect(summaries.SNACK.logged).toBeFalse();
  });

  it('files supper under dinner and unknown types under snack', () => {
    expect(slotForMealType('SUPPER')).toBe('DINNER');
    expect(slotForMealType('dinner')).toBe('DINNER');
    expect(slotForMealType('OTHER')).toBe('SNACK');
    expect(slotForMealType('MEAL')).toBe('SNACK');
    expect(slotForMealType('')).toBe('SNACK');
  });
});

describe('macro shares', () => {
  it('splits a meal by energy with 4, 4 and 9 kcal per gram', () => {
    // 25 g protein and 50 g carbohydrate are 100 and 200 kcal; 200/9 g of fat is 200 kcal.
    const shares = macroEnergyShares(25, 50, 200 / 9);

    expect(shares?.protein).toBeCloseTo(20, 5);
    expect(shares?.carbs).toBeCloseTo(40, 5);
    expect(shares?.fat).toBeCloseTo(40, 5);
  });

  it('always adds up to 100', () => {
    const shares = macroEnergyShares(6, 31, 15);

    expect((shares?.protein ?? 0) + (shares?.carbs ?? 0) + (shares?.fat ?? 0)).toBeCloseTo(100, 8);
  });

  it('is null when there is nothing to draw, and ignores negative grams', () => {
    expect(macroEnergyShares(0, 0, 0)).toBeNull();
    expect(macroEnergyShares(-5, -5, -5)).toBeNull();
    expect(macroEnergyShares(-5, 10, 0)?.carbs).toBe(100);
  });
});

describe('percent and figure helpers', () => {
  it('gives a whole percent of the target', () => {
    expect(percentOfTarget(269, 2100)).toBe(13);
    expect(percentOfTarget(1050, 2100)).toBe(50);
    expect(percentOfTarget(2500, 2100)).toBe(119);
  });

  it('gives null without a usable target', () => {
    expect(percentOfTarget(269, null)).toBeNull();
    expect(percentOfTarget(269, undefined)).toBeNull();
    expect(percentOfTarget(269, 0)).toBeNull();
    expect(percentOfTarget(Number.NaN, 2100)).toBeNull();
  });

  it('holds a bar between empty and full', () => {
    expect(fillPercent(2500, 2100)).toBe(100);
    expect(fillPercent(-10, 2100)).toBe(0);
    expect(fillPercent(500, null)).toBe(0);
  });

  it('writes figures with thousands separators and never a bad number', () => {
    expect(wholeNumber(1420)).toBe('1,420');
    expect(wholeNumber(85.6)).toBe('86');
    expect(wholeNumber(Number.NaN)).toBe('0');
  });

  it('writes a budget figure with and without a target', () => {
    expect(budgetFigure(1420, 2100, 'kcal')).toBe('1,420 of 2,100 kcal');
    expect(budgetFigure(86, 140, 'g')).toBe('86 of 140 g');
    expect(budgetFigure(1420, null, 'kcal')).toBe('1,420 kcal');
    expect(budgetFigure(0, 0, 'g')).toBe('0 g');
  });
});
