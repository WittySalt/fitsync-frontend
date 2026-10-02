import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { FoodSearchResult } from '../../../core/fitsync.models';
import { IngredientPickerComponent } from './ingredient-picker.component';

const oats: FoodSearchResult = {
  foodId: 'f1',
  displayName: 'Rolled oats',
  brandName: '',
  categoryName: 'Grains',
  scope: 'CATALOG',
  calories: 379.6,
  proteinGrams: 0,
  basisUnit: 'g',
  basisLabel: '100 g',
  primaryBarcode: '',
  verified: true
};

describe('IngredientPickerComponent', () => {
  let data: jasmine.SpyObj<FitSyncDataService>;

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['searchFoods']);
    data.searchFoods.and.returnValue(of([oats]));
    TestBed.configureTestingModule({ providers: [{ provide: FitSyncDataService, useValue: data }] });
  });

  function render(): ComponentFixture<IngredientPickerComponent> {
    const fixture = TestBed.createComponent(IngredientPickerComponent);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<IngredientPickerComponent>) => fixture.nativeElement as HTMLElement;
  const type = (fixture: ComponentFixture<IngredientPickerComponent>, value: string) => {
    const input = el(fixture).querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  it('waits for a pause in typing, then searches the food catalogue for a few matches', fakeAsync(() => {
    const fixture = render();

    type(fixture, 'oa');
    tick(150);
    type(fixture, 'oats');
    tick(299);
    expect(data.searchFoods).not.toHaveBeenCalled();
    tick(1);
    fixture.detectChanges();

    expect(data.searchFoods).toHaveBeenCalledOnceWith('oats', { size: 8 });
    expect(el(fixture).querySelector('li .name')?.textContent).toBe('Rolled oats');
    expect(el(fixture).querySelector('li .kcal')?.textContent).toBe('380 kcal a 100 g');
  }));

  it('caps the box at 80 characters', () => {
    expect(el(render()).querySelector('input')?.getAttribute('maxlength')).toBe('80');
  });

  it('offers the chosen food and clears the search', fakeAsync(() => {
    const fixture = render();
    const picked: string[] = [];
    fixture.componentInstance.pick.subscribe((food) => picked.push(food.displayName));
    type(fixture, 'oats');
    tick(300);
    fixture.detectChanges();

    (el(fixture).querySelector('li button') as HTMLButtonElement).click();
    fixture.detectChanges();
    tick(300);

    expect(picked).toEqual(['Rolled oats']);
    expect(el(fixture).querySelector('li')).toBeNull();
    expect((el(fixture).querySelector('input') as HTMLInputElement).value).toBe('');
  }));

  it('says when nothing matches', fakeAsync(() => {
    data.searchFoods.and.returnValue(of([]));
    const fixture = render();

    type(fixture, 'zzz');
    tick(300);
    fixture.detectChanges();

    expect(el(fixture).querySelector('.note')?.textContent).toContain('No foods match');
  }));

  it('does not search for blank text and drops old results', fakeAsync(() => {
    const fixture = render();
    type(fixture, 'oats');
    tick(300);
    fixture.detectChanges();
    expect(el(fixture).querySelector('li')).not.toBeNull();

    type(fixture, '   ');
    fixture.detectChanges();
    tick(300);
    fixture.detectChanges();

    expect(data.searchFoods).toHaveBeenCalledTimes(1);
    expect(el(fixture).querySelector('li')).toBeNull();
    expect(el(fixture).querySelector('.note')).toBeNull();
  }));
});
