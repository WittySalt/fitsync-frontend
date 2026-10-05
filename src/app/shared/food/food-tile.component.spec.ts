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

  it('draws the brand logo after the photo and before the group icon', () => {
    show({ logoUrl: 'https://logo.clearbit.com/kfc.com', brandName: 'KFC', categoryCode: 'MEAT_POULTRY' });

    const img = el().querySelector('img.logo') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://logo.clearbit.com/kfc.com');
    expect(img.alt).toBe('KFC');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(icon()).toBeNull();
  });

  it('prefers the food photo over the brand logo', () => {
    show({ imageUrl: 'https://images.example/a.jpg', logoUrl: 'https://logo.clearbit.com/kfc.com' });

    expect(el().querySelectorAll('img').length).toBe(1);
    expect(el().querySelector('img.logo')).toBeNull();
  });

  it('falls back to the group icon when the logo fails to load', () => {
    show({ logoUrl: 'https://logo.clearbit.com/gone.example', categoryCode: 'VEGETABLES' });
    el().querySelector('img.logo')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(el().querySelector('img')).toBeNull();
    expect(icon().style.getPropertyValue('--tile')).toBe('var(--food-veg)');
  });

  it('falls back to the plate icon when the logo fails and there is no group', () => {
    show({ logoUrl: 'https://logo.clearbit.com/gone.example' });
    el().querySelector('img.logo')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(icon().style.getPropertyValue('--tile')).toBe('var(--text-secondary)');
  });

  it('never draws a brand letter, whatever the food carries', () => {
    show({ categoryCode: 'MEAT_POULTRY', brandName: "McDonald's" });

    expect(el().querySelector('.brand')).toBeNull();
    expect(el().textContent?.trim()).toBe('');
  });
});
