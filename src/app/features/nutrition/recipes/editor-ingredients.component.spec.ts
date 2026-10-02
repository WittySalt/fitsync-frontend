import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { EditorIngredientsComponent } from './editor-ingredients.component';
import { EditorRow } from './recipes-editor';

const rows = (): EditorRow[] =>
  [
    ['Rolled oats', 'GRAINS', 160],
    ['Milk', 'DAIRY', 480],
    ['Banana', 'FRUIT', 240]
  ].map(([name, group, grams], index) => ({
    key: index + 1,
    foodCatalogItemId: `f${index}`,
    name: name as string,
    grams: grams as number,
    detail: null,
    group: group as EditorRow['group'],
    categoryCode: null
  }));

describe('EditorIngredientsComponent', () => {
  let fixture: ComponentFixture<EditorIngredientsComponent>;
  const moves: { from: number; to: number }[] = [];
  const grams: { key: number; grams: number | null }[] = [];
  const removed: number[] = [];

  beforeEach(() => {
    moves.length = 0;
    grams.length = 0;
    removed.length = 0;
    TestBed.configureTestingModule({ providers: [{ provide: FitSyncDataService, useValue: { searchFoods: () => [] } }] });
    fixture = TestBed.createComponent(EditorIngredientsComponent);
    fixture.componentRef.setInput('rows', rows());
    fixture.componentInstance.moved.subscribe((move) => moves.push(move));
    fixture.componentInstance.grams.subscribe((change) => grams.push(change));
    fixture.componentInstance.removed.subscribe((key) => removed.push(key));
    fixture.detectChanges();
  });

  const el = () => fixture.nativeElement as HTMLElement;
  const items = () => Array.from(el().querySelectorAll('li'));

  it('shows a row for each ingredient with a handle, an icon, a name and the grams', () => {
    expect(items().length).toBe(3);
    expect(items()[0].querySelector('app-reorder .grip')).not.toBeNull();
    expect(items()[0].querySelector('app-food-icon')).not.toBeNull();
    expect(items()[1].querySelector('.name')?.textContent).toBe('Milk');
    expect((items()[1].querySelector('.grams input') as HTMLInputElement).value).toBe('480');
  });

  it('moves a row with the Move buttons, the first cannot go up and the last cannot go down', () => {
    expect((items()[0].querySelector('.up') as HTMLButtonElement).disabled).toBeTrue();
    expect((items()[2].querySelector('.down') as HTMLButtonElement).disabled).toBeTrue();
    expect(items()[1].querySelector('.up')?.getAttribute('aria-label')).toBe('Move Milk up');
    (items()[1].querySelector('.down') as HTMLButtonElement).click();
    (items()[1].querySelector('.up') as HTMLButtonElement).click();
    expect(moves).toEqual([
      { from: 1, to: 2 },
      { from: 1, to: 0 }
    ]);
  });

  it('moves a row by dragging its grip onto another row', () => {
    const grip = items()[0].querySelector('.grip') as HTMLElement;
    const drag = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent & { dataTransfer: Partial<DataTransfer> };
      Object.defineProperty(event, 'dataTransfer', { value: { setData: () => undefined, setDragImage: () => undefined, effectAllowed: '' } });
      return event;
    };
    grip.dispatchEvent(drag('dragstart'));
    items()[2].dispatchEvent(drag('dragover'));
    fixture.detectChanges();
    expect(items()[2].classList.contains('over')).toBeTrue();
    items()[2].dispatchEvent(drag('drop'));
    fixture.detectChanges();
    expect(moves).toEqual([{ from: 0, to: 2 }]);
    expect(items()[2].classList.contains('over')).toBeFalse();
  });

  it('ignores a drop on the row that was picked up and a drop with nothing picked up', () => {
    const event = () => Object.assign(new Event('drop', { cancelable: true }), { dataTransfer: null }) as unknown as DragEvent;
    items()[1].dispatchEvent(event());
    expect(moves).toEqual([]);
  });

  it('steps the grams by 10 and keeps them above zero', () => {
    (items()[0].querySelector('app-stepper button:last-of-type') as HTMLButtonElement).click();
    (items()[0].querySelector('app-stepper button') as HTMLButtonElement).click();
    expect(grams).toEqual([
      { key: 1, grams: 170 },
      { key: 1, grams: 150 }
    ]);
    fixture.componentRef.setInput('rows', [{ ...rows()[0], grams: 10 }]);
    fixture.detectChanges();
    expect((items()[0].querySelector('app-stepper button') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('reports typed grams, an empty box as none, and a removal', () => {
    const input = items()[2].querySelector('.grams input') as HTMLInputElement;
    input.value = '250,5';
    input.dispatchEvent(new Event('input'));
    input.value = '';
    input.dispatchEvent(new Event('input'));
    (items()[2].querySelector('.remove') as HTMLButtonElement).click();
    expect(grams).toEqual([
      { key: 3, grams: 250.5 },
      { key: 3, grams: null }
    ]);
    expect(removed).toEqual([3]);
  });

  it('says it is adding and shows what is wrong', () => {
    fixture.componentRef.setInput('adding', true);
    fixture.componentRef.setInput('error', 'Add at least one ingredient.');
    fixture.detectChanges();
    expect(el().querySelector('.hint')?.textContent).toBe('Adding');
    expect(el().querySelector('em[role="alert"]')?.textContent).toBe('Add at least one ingredient.');
  });
});
