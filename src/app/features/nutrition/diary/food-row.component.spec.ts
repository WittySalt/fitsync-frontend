import { TestBed } from '@angular/core/testing';

import { FoodRowComponent } from './food-row.component';
import { item } from './diary-testing.spec';

describe('FoodRowComponent', () => {
  function render(overrides: Parameters<typeof item>[0]): HTMLElement {
    const fixture = TestBed.createComponent(FoodRowComponent);
    fixture.componentRef.setInput('item', item(overrides));
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('leads with the same food tile as the builder: the group icon in its colour', () => {
    const tile = render({ foodGroup: 'PROTEIN', categoryCode: 'MEAT_POULTRY' }).querySelector('app-food-tile app-food-icon') as HTMLElement;

    expect(tile.style.getPropertyValue('--tile')).toBe('var(--food-protein)');
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it('never leaves an empty square: a food with no group gets the plate icon', () => {
    const tile = render({ foodGroup: null, categoryCode: null }).querySelector('app-food-tile app-food-icon') as HTMLElement;

    expect(tile.style.getPropertyValue('--tile')).toBe('var(--text-secondary)');
    expect(tile.querySelector('svg')).not.toBeNull();
  });
});
