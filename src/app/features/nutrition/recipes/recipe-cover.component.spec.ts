import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeCoverComponent } from './recipe-cover.component';

describe('RecipeCoverComponent', () => {
  function render(inputs: Record<string, unknown>): ComponentFixture<RecipeCoverComponent> {
    const fixture = TestBed.createComponent(RecipeCoverComponent);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<RecipeCoverComponent>) => fixture.nativeElement as HTMLElement;

  it('shows the photo lazily and fixes the shape with a ratio', () => {
    const fixture = render({ imageUrl: 'https://img.example/a.jpg', ratio: '16 / 9' });
    const img = el(fixture).querySelector('img') as HTMLImageElement;

    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('src')).toBe('https://img.example/a.jpg');
    expect(img.getAttribute('alt')).toBe('');
    expect(el(fixture).style.aspectRatio).toBe('16 / 9');
    expect(el(fixture).querySelector('.fallback')).toBeNull();
  });

  it('uses a fixed height instead of the ratio when one is given', () => {
    const fixture = render({ imageUrl: 'https://img.example/a.jpg', height: 44, width: 44, radius: 12 });

    expect(el(fixture).style.height).toBe('44px');
    expect(el(fixture).style.width).toBe('44px');
    expect(el(fixture).style.aspectRatio).toBe('');
    expect(el(fixture).style.borderRadius).toBe('12px');
  });

  it('draws the top food groups on their tints when the photo fails to load', () => {
    const fixture = render({ imageUrl: 'https://img.example/gone.jpg', groups: ['VEG', 'PROTEIN', 'FRUIT', 'DAIRY'] });

    el(fixture).querySelector('img')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(el(fixture).querySelector('img')).toBeNull();
    expect(el(fixture).querySelectorAll('.dot').length).toBe(3);
    expect((el(fixture).querySelector('.fallback') as HTMLElement).style.background).toContain('--food-veg');
  });

  it('draws the cover at once when the recipe has no photo', () => {
    const fixture = render({ imageUrl: null, groups: ['LEGUMES', 'GRAINS'] });

    expect(el(fixture).querySelector('img')).toBeNull();
    expect(el(fixture).querySelectorAll('.dot').length).toBe(2);
  });

  it('draws a plain tile without groups, and no icons', () => {
    const fixture = render({ imageUrl: null, groups: [] });

    expect(el(fixture).querySelectorAll('.dot').length).toBe(0);
    expect(el(fixture).querySelector('.fallback')).not.toBeNull();
  });

  it('tries a new photo after a failed one is replaced', () => {
    const fixture = render({ imageUrl: 'https://img.example/gone.jpg', groups: ['VEG'] });
    el(fixture).querySelector('img')?.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    fixture.componentRef.setInput('imageUrl', 'https://img.example/new.jpg');
    fixture.detectChanges();

    expect(el(fixture).querySelector('img')?.getAttribute('src')).toBe('https://img.example/new.jpg');
  });

  it('credits the photo only when asked, and not on a fallback cover', () => {
    expect(el(render({ imageUrl: 'https://img.example/a.jpg' })).querySelector('.credit')).toBeNull();

    const credited = render({ imageUrl: 'https://img.example/a.jpg', credit: true, creditTop: true });
    expect(el(credited).querySelector('.credit')?.textContent).toBe('Photo from TheMealDB');
    expect(el(credited).querySelector('.credit')?.classList.contains('top')).toBeTrue();

    const none = render({ imageUrl: null, credit: true });
    expect(el(none).querySelector('.credit')).toBeNull();
  });
});
