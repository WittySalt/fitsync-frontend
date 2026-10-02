import { TestBed } from '@angular/core/testing';

import { NutrientTileComponent } from './nutrient-tile.component';
import { NutrientTileData } from './nutrients.models';
import { tile } from './nutrients-testing.spec';

describe('NutrientTileComponent', () => {
  function render(data: NutrientTileData, selected = false) {
    const fixture = TestBed.createComponent(NutrientTileComponent);
    fixture.componentRef.setInput('nutrient', data);
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, button: el.querySelector('button') as HTMLButtonElement };
  }

  it('is a button with a spoken label', () => {
    const { button } = render(tile({ share: 0.34 }));
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('aria-label')).toBe('Vitamin D, 34% of the daily amount');
  });

  it('fills from the bottom by the share and shows the percentage', () => {
    const { el } = render(tile({ share: 0.34 }));
    expect((el.querySelector('.fill') as HTMLElement).style.height).toBe('34%');
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('34%');
  });

  it('shows nothing in the corner of a vitamin and the atomic number of a mineral', () => {
    expect(render(tile({ atomicNumber: null })).el.querySelector('.atomic')?.textContent?.trim()).toBe('');
    expect(render(tile({ code: 'IRON', symbol: 'Fe', atomicNumber: 26 })).el.querySelector('.atomic')?.textContent?.trim()).toBe('26');
  });

  it('ticks a reached nutrient and tints it fully', () => {
    const { el } = render(tile({ share: 1.04 }));
    expect(el.querySelector('button')?.classList.contains('reached')).toBeTrue();
    expect(el.querySelector('.value app-food-glyph')).not.toBeNull();
    expect(el.querySelector('.value')?.textContent).toContain('104%');
    expect((el.querySelector('.fill') as HTMLElement).style.height).toBe('100%');
  });

  it('shows a limit in grey and says over when it is passed', () => {
    const under = render(tile({ groupCode: 'LIMIT', share: 0.82 }));
    expect(under.button.classList.contains('limit')).toBeTrue();
    expect(under.button.classList.contains('over')).toBeFalse();
    const over = render(tile({ groupCode: 'LIMIT', share: 1.15 }));
    expect(over.button.classList.contains('over')).toBeTrue();
    expect(over.el.querySelector('.value')?.textContent?.trim()).toBe('over');
  });

  it('says no data for an unknown nutrient and does not fill it', () => {
    const { el } = render(tile({ share: null }));
    expect(el.querySelector('.value')?.textContent?.trim()).toBe('no data');
    expect((el.querySelector('.fill') as HTMLElement).style.height).toBe('0%');
  });

  it('marks the selected tile as pressed', () => {
    expect(render(tile(), true).button.getAttribute('aria-pressed')).toBe('true');
    expect(render(tile(), false).button.getAttribute('aria-pressed')).toBe('false');
  });

  it('tells the page which nutrient was picked', () => {
    const { fixture, button } = render(tile({ code: 'IRON' }));
    let picked = '';
    fixture.componentInstance.pick.subscribe((value) => (picked = value.code));
    button.click();
    expect(picked).toBe('IRON');
  });

  it('is only a display, hidden from assistive technology, when it is not interactive', () => {
    const fixture = TestBed.createComponent(NutrientTileComponent);
    fixture.componentRef.setInput('nutrient', tile());
    fixture.componentRef.setInput('interactive', false);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect(button.getAttribute('aria-hidden')).toBe('true');
  });
});
