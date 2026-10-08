import { DayMeal, UsualMeal } from '../../../core/fitsync.models';
import {
  budgetFigure,
  clockMinutes,
  defaultMealSlot,
  dueMealSlot,
  fillPercent,
  loggedAhead,
  macroEnergyShares,
  percentOfTarget,
  slotForMealType,
  slotUsualMinutes,
  slotUsualTime,
  summariseSlots,
  todayAt,
  usualCombination,
  usualTimeAhead,
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

  it('does not count a fasted mark as a meal in any slot', () => {
    const summaries = summariseSlots([meal('FAST', 12, 0)]);

    expect(Object.values(summaries).every((slot) => !slot.logged && slot.calories === 0)).toBeTrue();
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

function usual(mealType: string, usualTime: string | null, sourceMealId: string | null = 'src'): UsualMeal {
  return {
    mealType,
    label: mealType,
    usualTime,
    sourceMealId,
    totalCalories: 400,
    totalProteinGrams: 20,
    totalCarbsGrams: 50,
    totalFatGrams: 10,
    items: []
  };
}

describe('usual times', () => {
  it('reads an HH:mm time and rejects anything else', () => {
    expect(clockMinutes('07:30')).toBe(450);
    expect(clockMinutes('24:00')).toBeNull();
    expect(clockMinutes('7:30')).toBeNull();
    expect(clockMinutes(null)).toBeNull();
  });

  it('takes the usual time of a slot and falls back to the default', () => {
    const meals = [usual('BREAKFAST', '09:00'), usual('LUNCH', 'late')];

    expect(slotUsualMinutes(meals, 'BREAKFAST')).toBe(9 * 60);
    expect(slotUsualMinutes(meals, 'LUNCH')).toBe(12 * 60 + 30);
    expect(slotUsualMinutes(meals, 'DINNER')).toBe(19 * 60);
    expect(slotUsualMinutes(meals, 'SNACK')).toBeNull();
    expect(slotUsualTime(meals, 'LUNCH')).toBeNull();
  });

  it('counts supper as dinner but prefers a dinner entry over it', () => {
    expect(slotUsualMinutes([usual('SUPPER', '20:00')], 'DINNER')).toBe(20 * 60);
    expect(slotUsualMinutes([usual('SUPPER', '20:00'), usual('DINNER', '18:30')], 'DINNER')).toBe(18 * 60 + 30);
  });

  it('opens the window an hour before the usual time and closes it ninety minutes after', () => {
    const meals = [usual('BREAKFAST', '10:00')];

    expect(dueMealSlot([], at(8, 59), meals)).toBeNull();
    expect(dueMealSlot([], at(9, 0), meals)).toBe('BREAKFAST');
    expect(dueMealSlot([], at(11, 29), meals)).toBe('BREAKFAST');
    // Lunch opens at 11:30 by default, so the breakfast window has to be checked by name.
    expect(dueMealSlot([], at(11, 31), meals)).not.toBe('BREAKFAST');
  });

  it('opens lunch from a usual lunch time that the default window would miss', () => {
    expect(defaultMealSlot([], at(10, 30), [usual('LUNCH', '11:00')])).toBe('LUNCH');
    expect(defaultMealSlot([], at(10, 30))).toBe('BREAKFAST');
  });

  it('uses the defaults when there are no usual meals', () => {
    expect(dueMealSlot([], at(12, 0))).toBe('LUNCH');
    expect(dueMealSlot([], at(18, 0), [])).toBe('DINNER');
  });

  it('never makes snack due, even with a usual snack time', () => {
    expect(dueMealSlot([], at(15, 0), [usual('SNACK', '15:00')])).toBeNull();
    expect(defaultMealSlot([], at(15, 0), [usual('SNACK', '15:00')])).toBe('BREAKFAST');
  });

  it('does not make a meal due once it is logged', () => {
    expect(dueMealSlot([meal('LUNCH', 12, 500)], at(12, 40))).toBeNull();
  });

  it('names a combination only when a source meal exists', () => {
    expect(usualCombination([usual('LUNCH', '12:00', null)], 'LUNCH')).toBeNull();
    expect(usualCombination([usual('LUNCH', '12:00')], 'LUNCH')?.sourceMealId).toBe('src');
  });

  it('says whether a usual time is still ahead', () => {
    expect(usualTimeAhead('12:30', at(12, 29))).toBeTrue();
    expect(usualTimeAhead('12:30', at(12, 30))).toBeFalse();
    expect(usualTimeAhead(null, at(8, 0))).toBeFalse();
  });

  it('builds today at the usual time in the local zone', () => {
    expect(todayAt('07:30', at(15, 12))?.getTime()).toBe(at(7, 30).getTime());
    expect(todayAt('bad', at(15, 12))).toBeNull();
  });

  it('reads the time of day on the profile zone clock, not the device clock', () => {
    // 19:30 UTC on 30 September is 08:30 on 1 October in Auckland and 12:30 on 30 September in Los Angeles.
    const now = new Date('2026-09-30T19:30:00Z');
    expect(dueMealSlot([], now, [], 'Pacific/Auckland')).toBe('BREAKFAST');
    expect(dueMealSlot([], now, [], 'America/Los_Angeles')).toBe('LUNCH');
    expect(defaultMealSlot([], now, [], 'Pacific/Auckland')).toBe('BREAKFAST');
    expect(defaultMealSlot([], now, [], 'America/Los_Angeles')).toBe('LUNCH');
    expect(usualTimeAhead('12:00', now, 'Pacific/Auckland')).toBeTrue();
    expect(usualTimeAhead('12:00', now, 'America/Los_Angeles')).toBeFalse();
  });

  it('builds today at the usual time on the profile zone day', () => {
    // 11:30 UTC on 30 September is 00:30 on 1 October in Auckland and 04:30 on 30 September in Los Angeles.
    const now = new Date('2026-09-30T11:30:00Z');
    // 07:30 in Auckland (UTC+13) on 1 October, and 07:30 in Los Angeles (UTC-7) on 30 September.
    expect(todayAt('07:30', now, 'Pacific/Auckland')?.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(todayAt('07:30', now, 'America/Los_Angeles')?.toISOString()).toBe('2026-09-30T14:30:00.000Z');
  });

  it('builds today at the usual time on a day the clocks go forward', () => {
    // New Zealand goes from 02:00 to 03:00 on 27 September 2026, so 07:30 is at UTC+13 that day.
    const now = new Date('2026-09-27T00:00:00Z');
    expect(todayAt('07:30', now, 'Pacific/Auckland')?.toISOString()).toBe('2026-09-26T18:30:00.000Z');
    // 01:30 is still before the change, at UTC+12.
    expect(todayAt('01:30', now, 'Pacific/Auckland')?.toISOString()).toBe('2026-09-26T13:30:00.000Z');
  });

  it('finds a meal logged for a moment that has not come', () => {
    const ahead = [meal('LUNCH', 12, 500, { consumedAt: at(12, 30).toISOString() })];

    expect(loggedAhead(ahead, 'LUNCH', at(9, 0))).toBeTrue();
    expect(loggedAhead(ahead, 'LUNCH', at(13, 0))).toBeFalse();
    expect(loggedAhead(ahead, 'DINNER', at(9, 0))).toBeFalse();
  });
});
