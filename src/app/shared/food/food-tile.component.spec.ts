import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FoodTileComponent } from './food-tile.component';

describe('FoodTileComponent', () => {
  let fixture: ComponentFixture<FoodTileComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const icon = () => el().querySelector('app-food-icon') as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(FoodTileComponent);
  });

  function show(inputs: Record<string, unknown>): void {
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
  }

  it('shows the photo first when the food has an image', () => {
    show({ imageUrl: 'https://images.example/cereal.jpg', categoryCode: 'GRAINS' });

    expect((el().querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('https://images.example/cereal.jpg');
    expect(icon()).toBeNull();
  });

  it('then draws the group icon in its market colour', () => {
    show({ categoryCode: 'VEGETABLES' });

    expect(icon().style.getPropertyValue('--tile')).toBe('var(--food-veg)');
    expect(icon().querySelector('svg')).not.toBeNull();
    expect(el().style.width).toBe('40px');
  });

  it('takes the group a caller already knows over the category code', () => {
    show({ group: 'DRINKS', categoryCode: null });

    expect(icon().style.getPropertyValue('--tile')).toBe('var(--food-drinks)');
  });

  it('and last the plate and fork on the neutral colour when the food has no group', () => {
    show({ categoryCode: 'PREPARED_MEALS' });

    expect(icon().style.getPropertyValue('--tile')).toBe('var(--text-secondary)');
    expect(icon().querySelectorAll('svg circle, svg path').length).toBeGreaterThan(0);
  });

  it('never draws a brand letter, whatever the food carries', () => {
    show({ categoryCode: 'MEAT_POULTRY', brandName: "McDonald's" });

    expect(el().querySelector('.brand')).toBeNull();
    expect(el().textContent?.trim()).toBe('');
  });
});
