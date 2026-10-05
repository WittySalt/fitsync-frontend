import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FoodTileComponent } from './food-tile.component';

describe('FoodTileComponent', () => {
  let fixture: ComponentFixture<FoodTileComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(FoodTileComponent);
  });

  function show(inputs: Record<string, unknown>): void {
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
  }

  it('draws the food group icon in its market colour when the food has no brand', () => {
    show({ categoryCode: 'VEGETABLES' });

    const icon = el().querySelector('app-food-icon') as HTMLElement;
    expect(icon).not.toBeNull();
    expect(icon.style.getPropertyValue('--tile')).toBe('var(--food-veg)');
    expect(el().querySelector('.brand')).toBeNull();
    expect(el().style.width).toBe('40px');
  });

  it('draws a brand tile with the first letter and the brand as its title', () => {
    show({ brandName: "McDonald's", categoryCode: 'MEAT_POULTRY' });

    const brand = el().querySelector('.brand') as HTMLElement;
    expect(brand.textContent?.trim()).toBe('M');
    expect(brand.getAttribute('title')).toBe("McDonald's");
    expect(el().querySelector('app-food-icon')).toBeNull();
  });

  it('shows the photo when the food has an image, ahead of the brand', () => {
    show({ brandName: 'Kellogg', imageUrl: 'https://images.example/cereal.jpg' });

    const image = el().querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('https://images.example/cereal.jpg');
    expect(el().querySelector('.brand')).toBeNull();
  });

  it('ignores a blank brand', () => {
    show({ brandName: '   ', categoryCode: 'DAIRY' });

    expect(el().querySelector('.brand')).toBeNull();
    expect(el().querySelector('app-food-icon')).not.toBeNull();
  });
});
