import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AddDrinkDialogComponent } from './add-drink-dialog.component';
import { DrinkDetail, DrinkOption } from './diary.models';
import { DrinkAdd } from './drink-drink-panel.component';
import { WaterAdd } from './drink-water-panel.component';
import { NutritionDiaryService } from './nutrition-diary.service';
import { diaryServiceStub, spoken as text } from './diary-testing.spec';

const juiceOption: DrinkOption = { foodId: 'oj', name: 'Orange juice', calories: 45, basisLabel: '100 ml', countsTowardWater: true };
const beerOption: DrinkOption = { foodId: 'beer', name: 'Beer, regular', calories: 43, basisLabel: '100 ml', countsTowardWater: false };

function detail(overrides: Partial<DrinkDetail> = {}): DrinkDetail {
  return {
    foodId: 'oj',
    displayName: 'Orange juice',
    brandName: '',
    categoryName: null,
    scope: 'CATALOG',
    calories: 45,
    proteinGrams: 0.7,
    carbsGrams: 10,
    fatGrams: 0.2,
    fiberGrams: null,
    sugarGrams: 8.4,
    sodiumMg: null,
    basisQuantity: 100,
    basisUnit: 'ml',
    densityGramsPerMl: null,
    primaryBarcode: '',
    sourceDataset: null,
    servings: [{ servingId: 's1', label: '1 cup', quantity: 1, unit: 'cup', gramsEquivalent: 250, millilitersEquivalent: 250, sortOrder: 0, defaultServing: true }],
    foodGroup: 'DRINKS',
    countsTowardWater: true,
    waterGrams: 88,
    alcoholGrams: 0,
    ...overrides
  };
}

describe('AddDrinkDialogComponent', () => {
  let diary: jasmine.SpyObj<NutritionDiaryService>;
  const today = '2026-10-02';

  beforeEach(() => {
    diary = diaryServiceStub();
    diary.recentDrinks.and.returnValue(of([juiceOption]));
    diary.getDrinkDetail.and.returnValue(of(detail()));
    TestBed.configureTestingModule({ providers: [{ provide: NutritionDiaryService, useValue: diary }] });
  });

  function open(date = today): ComponentFixture<AddDrinkDialogComponent> {
    const fixture = TestBed.createComponent(AddDrinkDialogComponent);
    fixture.componentRef.setInput('date', date);
    fixture.componentRef.setInput('today', today);
    fixture.detectChanges();
    return fixture;
  }

  const q = <T extends Element>(fixture: ComponentFixture<unknown>, selector: string): T => fixture.nativeElement.querySelector(selector) as T;
  /** The figures of the preview, each as its number and its words: ["+ 220 ml towards water", "113 kcal"]. */
  const figures = (fixture: ComponentFixture<unknown>) =>
    Array.from(fixture.nativeElement.querySelectorAll('.preview .parts div') as NodeListOf<HTMLElement>).map((part) =>
      Array.from(part.children).map((child) => child.textContent?.trim()).join(' ')
    );

  describe('as a dialog', () => {
    it('opens on the Water tab with the amounts from the design and 250 ml chosen', () => {
      const fixture = open();
      expect(text(q(fixture, 'h2'))).toBe('Add a drink');
      const tiles = Array.from(fixture.nativeElement.querySelectorAll('.tile') as NodeListOf<HTMLElement>);
      expect(tiles.map((tile) => text(tile))).toEqual(['150 ml', '250 ml', '330 ml', '500 ml', '750 ml']);
      expect(tiles[1].classList.contains('selected')).toBeTrue();
      expect(text(q(fixture, '.add'))).toBe('Add 250 ml of water');
    });

    it('emits the chosen amount with the time, and says what it adds on the button', () => {
      const fixture = open();
      const added: WaterAdd[] = [];
      fixture.componentInstance.addWater.subscribe((value) => added.push(value));
      (fixture.nativeElement.querySelectorAll('.tile')[3] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(text(q(fixture, '.add'))).toBe('Add 500 ml of water');
      q<HTMLButtonElement>(fixture, '.add').click();
      expect(added.length).toBe(1);
      expect(added[0].ml).toBe(500);
      expect(Math.abs(added[0].at.getTime() - Date.now())).toBeLessThan(5000);
    });

    it('takes a typed amount, unselects the tiles, and refuses one that is out of range', () => {
      const fixture = open();
      const input = q<HTMLInputElement>(fixture, '.input input');
      input.value = '420';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(text(q(fixture, '.add'))).toBe('Add 420 ml of water');
      expect(fixture.nativeElement.querySelector('.tile.selected')).toBeNull();

      input.value = '9000';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(q<HTMLButtonElement>(fixture, '.add').disabled).toBeTrue();
      expect(q(fixture, '.hint')).not.toBeNull();

      input.value = '';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(q<HTMLButtonElement>(fixture, '.add').disabled).toBeTrue();
    });

    it('uses the time chosen with Change', () => {
      const fixture = open();
      const added: WaterAdd[] = [];
      fixture.componentInstance.addWater.subscribe((value) => added.push(value));
      expect(text(q(fixture, 'app-drink-when .text'))).toMatch(/^Now, \d\d:\d\d$/);
      q<HTMLButtonElement>(fixture, 'app-drink-when button').click();
      fixture.detectChanges();
      const time = q<HTMLInputElement>(fixture, 'app-drink-when input');
      time.value = '08:15';
      time.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      expect(text(q(fixture, 'app-drink-when .text'))).toBe('Today, 08:15');
      q<HTMLButtonElement>(fixture, '.add').click();
      expect(added[0].at.getHours()).toBe(8);
      expect(added[0].at.getMinutes()).toBe(15);
    });

    it('logs to the day being shown, at noon, when that is not today', () => {
      const fixture = open('2026-10-01');
      const added: WaterAdd[] = [];
      fixture.componentInstance.addWater.subscribe((value) => added.push(value));
      expect(text(q(fixture, 'app-drink-when .text'))).toContain('Thursday 1 Oct, 12:00');
      q<HTMLButtonElement>(fixture, '.add').click();
      expect(added[0].at.getDate()).toBe(1);
      expect(added[0].at.getHours()).toBe(12);
    });

    it('cannot add while busy', () => {
      const fixture = TestBed.createComponent(AddDrinkDialogComponent);
      fixture.componentRef.setInput('date', today);
      fixture.componentRef.setInput('today', today);
      fixture.componentRef.setInput('busy', true);
      fixture.detectChanges();
      expect(q<HTMLButtonElement>(fixture, '.add').disabled).toBeTrue();
    });

    it('closes from the close button, the backdrop and Escape', () => {
      const fixture = open();
      let closed = 0;
      fixture.componentInstance.closed.subscribe(() => (closed += 1));
      q<HTMLButtonElement>(fixture, '.close').click();
      q<HTMLElement>(fixture, '.backdrop').click();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(closed).toBe(3);
    });

    it('is labelled as a modal dialog and takes the focus', async () => {
      const fixture = open();
      await fixture.whenStable();
      expect(q(fixture, '[role="dialog"]').getAttribute('aria-modal')).toBe('true');
      expect(document.activeElement).toBe(q(fixture, '.panel'));
    });
  });

  describe('the Drink tab', () => {
    function openDrinks(): ComponentFixture<AddDrinkDialogComponent> {
      const fixture = open();
      (fixture.nativeElement.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      return fixture;
    }

    it('lists recent drinks and shows nothing to add until one is chosen', () => {
      const fixture = openDrinks();
      expect(text(q(fixture, '.recent'))).toContain('Orange juice');
      expect(q(fixture, '.preview')).toBeNull();
      expect(q(fixture, '.add')).toBeNull();
    });

    it('shows the sizes and what a Small drink adds once a drink is chosen', () => {
      const fixture = openDrinks();
      q<HTMLButtonElement>(fixture, '.chip').click();
      fixture.detectChanges();
      expect(diary.getDrinkDetail).toHaveBeenCalledWith('oj');
      expect(Array.from(fixture.nativeElement.querySelectorAll('.size strong') as NodeListOf<HTMLElement>).map((node) => node.textContent)).toEqual(['Small', 'Medium', 'Large', 'Other']);
      expect(figures(fixture)).toEqual(['+ 220 ml towards water', '113 kcal', '21 g sugar']);
      expect(text(q(fixture, 'app-drink-when .text'))).toMatch(/counts in (Breakfast|Lunch|Dinner|Snack)$/);
      expect(text(q(fixture, '.add'))).toBe('Add orange juice');
    });

    it('rescales the preview for another size and logs the item of that size', () => {
      const fixture = openDrinks();
      const added: DrinkAdd[] = [];
      fixture.componentInstance.addDrink.subscribe((value) => added.push(value));
      q<HTMLButtonElement>(fixture, '.chip').click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelectorAll('.size')[2] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(figures(fixture)).toEqual(['+ 440 ml towards water', '225 kcal', '42 g sugar']);
      q<HTMLButtonElement>(fixture, '.add').click();
      expect(added.length).toBe(1);
      expect(added[0].name).toBe('Orange juice');
      expect(added[0].item.foodCatalogItemId).toBe('oj');
      expect(added[0].item.calories).toBe(225);
    });

    it('takes a typed size under Other', () => {
      const fixture = openDrinks();
      q<HTMLButtonElement>(fixture, '.chip').click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelectorAll('.size')[3] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q<HTMLButtonElement>(fixture, '.add').disabled).toBeTrue();
      const input = q<HTMLInputElement>(fixture, '.field input');
      input.value = '330';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(q<HTMLButtonElement>(fixture, '.add').disabled).toBeFalse();
      expect(figures(fixture)[1]).toBe('149 kcal');
    });

    it('shows alcohol in place of sugar, zero towards water, and the note', () => {
      diary.recentDrinks.and.returnValue(of([beerOption]));
      diary.getDrinkDetail.and.returnValue(of(detail({ foodId: 'beer', displayName: 'Beer, regular', calories: 43, sugarGrams: 0, alcoholGrams: 3.9, countsTowardWater: false })));
      const fixture = openDrinks();
      q<HTMLButtonElement>(fixture, '.chip').click();
      fixture.detectChanges();
      expect(figures(fixture)).toEqual(['0 ml towards water', '108 kcal', '9.8 g alcohol']);
      expect(text(q(fixture, '.preview p'))).toContain('do not count towards water');
      expect(text(q(fixture, '.add'))).toBe('Add beer, regular');
    });

    it('searches only drinks after a pause and lists what it finds', fakeAsync(() => {
      diary.searchDrinks.and.returnValue(of([juiceOption, { ...juiceOption, foodId: 'oj2', name: 'Orange juice, with pulp' }]));
      const fixture = openDrinks();
      const input = q<HTMLInputElement>(fixture, '.search input');
      input.value = 'orange';
      input.dispatchEvent(new Event('input'));
      tick(100);
      expect(diary.searchDrinks).not.toHaveBeenCalled();
      tick(200);
      fixture.detectChanges();
      expect(diary.searchDrinks).toHaveBeenCalledWith('orange');
      const rows = Array.from(fixture.nativeElement.querySelectorAll('.result') as NodeListOf<HTMLElement>);
      expect(rows.length).toBe(2);
      expect(text(rows[0])).toContain('per 100 ml · 45 kcal');
      rows[1].click();
      expect(diary.getDrinkDetail).toHaveBeenCalledWith('oj2');
    }));

    it('says so when a search finds nothing, and does not search for one letter', fakeAsync(() => {
      const fixture = openDrinks();
      const input = q<HTMLInputElement>(fixture, '.search input');
      input.value = 'o';
      input.dispatchEvent(new Event('input'));
      tick(300);
      fixture.detectChanges();
      expect(diary.searchDrinks).not.toHaveBeenCalled();
      input.value = 'zzz';
      input.dispatchEvent(new Event('input'));
      tick(300);
      fixture.detectChanges();
      expect(text(q(fixture, '.note'))).toBe('No drinks found. Try another word.');
    }));

    it('asks to choose the drink again when it cannot load', () => {
      diary.getDrinkDetail.and.returnValue(throwError(() => new Error('down')));
      const fixture = openDrinks();
      q<HTMLButtonElement>(fixture, '.chip').click();
      fixture.detectChanges();
      expect(text(q(fixture, '.hint'))).toContain('could not load');
      expect(q(fixture, '.add')).toBeNull();
    });

    it('still works when recent drinks cannot load', () => {
      diary.recentDrinks.and.returnValue(throwError(() => new Error('down')));
      const fixture = openDrinks();
      expect(q(fixture, '.recent')).toBeNull();
      expect(q(fixture, '.search input')).not.toBeNull();
    });
  });
});
