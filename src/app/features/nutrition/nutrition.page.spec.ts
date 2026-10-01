import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AccountDataService } from '../../core/account-data.service';
import { CoachApiService } from '../../core/coach/coach-api.service';
import { CoachReading } from '../../core/coach/coach.models';
import { FitSyncDataService } from '../../core/fitsync-data.service';
import { diaryServiceStub, item, meal, rangeDay } from './diary/diary-testing.spec';
import { toIsoDate } from './diary/diary-time';
import { NutritionDiaryService } from './diary/nutrition-diary.service';
import { MealBuilderComponent } from './meal-builder.component';
import { NutritionPage } from './nutrition.page';

// The page carries an insight panel. Its store is real; only the wire is stubbed. The reading is
// empty, so the panel takes no space and the specs about the page itself are not disturbed.
const emptyReading: CoachReading = {
  surface: 'NUTRITION',
  status: 'EMPTY',
  readingId: null,
  period: 'NONE',
  periodStart: null,
  periodEnd: null,
  facts: [],
  reading: null,
  lifts: []
};
const coachApiStub = {
  listRecommendations: () => of([]),
  refreshRecommendations: () => of(undefined),
  getReading: jasmine.createSpy('getReading').and.returnValue(of(emptyReading))
};

describe('NutritionPage', () => {
  let diary: jasmine.SpyObj<NutritionDiaryService>;
  let dataService: jasmine.SpyObj<FitSyncDataService>;
  const today = toIsoDate(new Date());

  beforeEach(async () => {
    diary = diaryServiceStub();
    dataService = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', [
      'getUsualMeals',
      'copyMeal',
      'createMealTemplate',
      'getFoodCategories',
      'getRecentFoods',
      'getFavoriteFoods',
      'getFrequentFoods',
      'getMealTemplates',
      'searchFoodsPage',
      'getFoodDetail',
      'createMeal',
      'quickAddMeal',
      'getFoodByBarcode',
      'addFavoriteFood',
      'removeFavoriteFood',
      'getDailyNutritionSummary'
    ]);
    dataService.getDailyNutritionSummary.and.returnValue(
      of({
        totalCalories: 0,
        targetCalories: null,
        totalProteinGrams: 0,
        targetProteinGrams: null,
        totalCarbsGrams: 0,
        targetCarbsGrams: null,
        totalFatGrams: 0,
        targetFatGrams: null,
        mealCount: 0,
        totalFiberGrams: null,
        totalSugarGrams: null,
        totalSodiumMg: null,
        fiberTargetGrams: null,
        sugarLimitGrams: null,
        sodiumLimitMg: null,
        fiberTargetMet: null,
        sugarWithinLimit: null,
        sodiumWithinLimit: null
      })
    );
    dataService.getUsualMeals.and.returnValue(of([]));
    dataService.getFoodCategories.and.returnValue(of([]));
    dataService.getRecentFoods.and.returnValue(of([]));
    dataService.getFavoriteFoods.and.returnValue(of([]));
    dataService.getFrequentFoods.and.returnValue(of([]));
    dataService.getMealTemplates.and.returnValue(of([]));
    dataService.searchFoodsPage.and.returnValue(of({ items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 }));

    await TestBed.configureTestingModule({
      imports: [NutritionPage],
      providers: [
        // The page carries an insight panel, whose store reaches HttpClient through the API client.
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CoachApiService, useValue: coachApiStub },
        provideRouter([{ path: '**', children: [] }]),
        { provide: NutritionDiaryService, useValue: diary },
        { provide: FitSyncDataService, useValue: dataService },
        { provide: AccountDataService, useValue: { getCurrentUser: () => of({ preferences: { nutrition: { waterGoalMl: 2500 } } }) } }
      ]
    }).compileComponents();
  });

  function render(): ComponentFixture<NutritionPage> {
    const fixture = TestBed.createComponent(NutritionPage);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture;
  }

  describe('deep link to the meal builder', () => {
    async function open(query: string): Promise<ComponentFixture<NutritionPage>> {
      await TestBed.inject(Router).navigateByUrl(`/nutrition${query}`);
      return render();
    }

    function builderMealType(fixture: ComponentFixture<NutritionPage>): string | undefined {
      const builder = fixture.debugElement.query(By.directive(MealBuilderComponent));
      return builder?.componentInstance.mealForm.controls.mealType.value;
    }

    it('opens the builder with the requested meal type chosen', async () => {
      const fixture = await open('?log=LUNCH');

      expect(fixture.componentInstance.view()).toBe('log');
      expect(builderMealType(fixture)).toBe('LUNCH');
    });

    it('takes the meal type whatever its case', async () => {
      const fixture = await open('?log=breakfast');

      expect(builderMealType(fixture)).toBe('BREAKFAST');
    });

    it('ignores a value that is not a known meal type', async () => {
      const fixture = await open('?log=FASTING');

      expect(fixture.componentInstance.view()).toBe('diary');
      expect(builderMealType(fixture)).toBeUndefined();
    });

    it('stays on the Diary without the parameter', async () => {
      const fixture = await open('');

      expect(fixture.componentInstance.view()).toBe('diary');
    });
  });

  it('has a head like the Workout page: the title, the date and the calorie target', () => {
    diary.getRange.and.returnValue(of([rangeDay(today, { targetCalories: 2100 })]));
    const element = render().nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toBe('Nutrition');
    expect(element.querySelector('.head-line')?.textContent).toContain('2,100 kcal a day');
  });

  it('leaves the target out of the head line when there is none', () => {
    diary.getRange.and.returnValue(of([rangeDay(today, { targetCalories: null })]));
    const line = (render().nativeElement as HTMLElement).querySelector('.head-line')?.textContent ?? '';

    expect(line).not.toContain('kcal');
    expect(line.length).toBeGreaterThan(0);
  });

  it('mounts the insight panel for nutrition', () => {
    const compiled = render().nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-insight-panel').length).toBe(1);
    expect(coachApiStub.getReading).toHaveBeenCalledWith('NUTRITION', jasmine.any(String));
  });

  it('shows the week card and only a Diary tab', () => {
    const compiled = render().nativeElement as HTMLElement;

    expect(compiled.querySelectorAll('app-diary-week').length).toBe(1);
    const tabs = Array.from(compiled.querySelectorAll('.nutrition-tabs [role="tab"]')).map((tab) => tab.textContent?.trim());
    expect(tabs).toEqual(['Diary']);
  });

  it('asks for the Monday to Sunday week that holds today', () => {
    render();
    const [from, to] = diary.getRange.calls.mostRecent().args;

    expect(new Date(`${from}T00:00:00`).getDay()).toBe(1);
    expect(new Date(`${to}T00:00:00`).getDay()).toBe(0);
    expect(from <= today && today <= to).toBeTrue();
  });

  it('shows a retry in the week card when the week fails, and loads it again', () => {
    diary.getRange.and.returnValue(throwError(() => new Error('down')));
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.failed')).not.toBeNull();
    diary.getRange.and.returnValue(of([rangeDay(today)]));
    (compiled.querySelector('.failed button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(compiled.querySelector('.failed')).toBeNull();
    expect(compiled.querySelector('.days')).not.toBeNull();
  });

  it('shows the Diary for today and opens another day when its tile is tapped', () => {
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(diary.getMeals).toHaveBeenCalledWith(today);

    const first = compiled.querySelectorAll<HTMLButtonElement>('.day')[0];
    first.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedDate()).toBe(fixture.componentInstance.dates[0]);
    expect(diary.getMeals).toHaveBeenCalledWith(fixture.componentInstance.dates[0]);
  });

  it('opens the builder from a meal Add with that meal type chosen, and goes back to the Diary', () => {
    diary.getMeals.and.returnValue(of([meal({ mealType: 'LUNCH', items: [item()] })]));
    const fixture = render();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelectorAll<HTMLButtonElement>('.add')[2].click();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(fixture.componentInstance.view()).toBe('log');
    expect(compiled.querySelector('app-diary-day')).toBeNull();
    const builder = fixture.debugElement.query(By.directive(MealBuilderComponent));
    expect(builder.componentInstance.mealForm.controls.mealType.value).toBe('DINNER');

    (compiled.querySelector('.log-head button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(compiled.querySelector('app-diary-day')).not.toBeNull();
  });

  it('returns to today after a meal is saved, and reloads the Diary and the week', () => {
    const fixture = render();
    fixture.componentInstance.startLog('SNACK');
    fixture.detectChanges();
    const summaries = diary.getSummary.calls.count();
    const ranges = diary.getRange.calls.count();

    fixture.componentInstance.refreshAfterMealSave();
    fixture.detectChanges();

    expect(fixture.componentInstance.view()).toBe('diary');
    expect(fixture.componentInstance.selectedDate()).toBe(today);
    expect(diary.getSummary.calls.count()).toBeGreaterThan(summaries);
    expect(diary.getRange.calls.count()).toBeGreaterThan(ranges);
  });

  it('ignores an unknown meal type from the Add button', () => {
    const fixture = render();
    fixture.componentInstance.startLog('NOPE');
    fixture.detectChanges();

    expect(fixture.componentInstance.view()).toBe('log');
    const builder = fixture.debugElement.query(By.directive(MealBuilderComponent));
    expect(builder.componentInstance.mealForm.controls.mealType.value).not.toBe('NOPE');
  });
});
