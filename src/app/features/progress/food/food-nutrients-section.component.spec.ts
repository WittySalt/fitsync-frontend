import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { NutrientTileData, NutrientsOverview } from '../../nutrition/nutrients/nutrients.models';
import { FoodNutrition, FoodProgress } from '../progress-api.models';
import { FoodNutrientsSectionComponent } from './food-nutrients-section.component';
import { highlightsWithOverview } from './food-figures';

function tile(code: string, displayName: string, share: number | null, groupCode: NutrientTileData['groupCode'] = 'MAJOR_MINERAL'): NutrientTileData {
  return {
    code,
    displayName,
    unit: 'mg',
    groupCode,
    symbol: code.slice(0, 2),
    atomicNumber: null,
    averageAmount: share === null ? null : share * 100,
    reference: 100,
    share,
    met: share !== null && share >= 1,
    upperLimit: null,
    aboveUpperLimit: false,
    dayValues: []
  };
}

const OVERVIEW: NutrientsOverview = {
  daysLogged: 60,
  referenceLabel: null,
  nutrients: [tile('CALCIUM', 'Calcium', 0.67), tile('VIT_E', 'Vitamin E', 0.92, 'FAT_SOLUBLE'), tile('MAGNESIUM', 'Magnesium', 1.24), tile('ZINC', 'Zinc', 1.1, 'TRACE_MINERAL')]
};

const NUTRITION: FoodNutrition = {
  mealTimes: [],
  topFoods: [],
  cooks: null,
  recentWindow: { from: '2026-09-08', to: '2026-10-08' },
  lowestNutrients: [{ code: 'CALCIUM', displayName: 'Calcium', share: 0.64 }],
  habits: { loggedDays: 20, fibreMetDays: 10, waterMetDays: null }
};

const HABITS: FoodProgress['habits'] = { loggedDays: 20, fibreMetDays: 10, waterMetDays: null, loggedDaysPerMonth: [] } as FoodProgress['habits'];

describe('FoodNutrientsSectionComponent', () => {
  let fixture: ComponentFixture<FoodNutrientsSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FoodNutrientsSectionComponent], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    fixture = TestBed.createComponent(FoodNutrientsSectionComponent);
    fixture.componentRef.setInput('habits', HABITS);
    fixture.componentRef.setInput('range', { days: 90, caption: 'Last 3 months' });
  });

  it('takes the lowest three from the same read as the petals, so the chips and the petals agree', () => {
    fixture.componentRef.setInput('overview', OVERVIEW);
    fixture.componentRef.setInput('nutrition', NUTRITION);
    fixture.detectChanges();
    const chips = Array.from(fixture.nativeElement.querySelectorAll('.lowest li, .chip, .lowest span')).map((el) => (el as HTMLElement).textContent?.trim() ?? '');
    expect(chips.join(' ')).toContain('Calcium 67%');
    expect(chips.join(' ')).not.toContain('64%');
    expect((fixture.componentInstance as unknown as { nutrientAsk: () => string }).nutrientAsk()).toContain('the last 90 days');
  });

  it('falls back to nutrition\'s own lowest three when the petal read is missing', () => {
    fixture.componentRef.setInput('overview', null);
    fixture.componentRef.setInput('nutrition', NUTRITION);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Calcium 64%');
  });
});

describe('highlightsWithOverview', () => {
  const analyticsCard = { code: 'LOWEST_NUTRIENT', title: 'Calcium is the furthest short, 64% of the daily amount.', series: [], unit: '%', context: 'On average, 8 Sept to 8 Oct' };
  const other = { code: 'PLATE_SHIFT', title: 'More vegetables.', series: [], unit: '%', context: '' };

  it('replaces the lowest-nutrient card with the figure the petals show', () => {
    const result = highlightsWithOverview([other, analyticsCard], OVERVIEW, 90);
    expect(result.map((item) => item.code)).toEqual(['PLATE_SHIFT', 'LOWEST_NUTRIENT']);
    expect(result[1].title).toBe('Calcium is the furthest short, 67% of the daily amount.');
    expect(result[1].context).toBe('On average, the last 90 days');
  });

  it('adds the card when analytics had none and keeps the highlights as they came without the petal read', () => {
    expect(highlightsWithOverview([other], OVERVIEW, 30).some((item) => item.code === 'LOWEST_NUTRIENT')).toBeTrue();
    expect(highlightsWithOverview([other, analyticsCard], null, 90)).toEqual([other, analyticsCard]);
  });
});
