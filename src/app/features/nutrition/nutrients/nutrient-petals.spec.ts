import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NutrientPetalsComponent, petalTip } from './nutrient-petals.component';
import { NutrientTileData } from './nutrients.models';

function tile(code: string, displayName: string, averageAmount: number | null, reference: number, unit = 'mg'): NutrientTileData {
  const share = averageAmount === null ? null : averageAmount / reference;
  return { code, displayName, unit, groupCode: 'WATER_SOLUBLE', symbol: code.slice(0, 2), atomicNumber: null, averageAmount, reference, share, met: share !== null && share >= 1, upperLimit: null, aboveUpperLimit: false, dayValues: [] };
}

describe('the petal tooltip', () => {
  let fixture: ComponentFixture<NutrientPetalsComponent>;
  let host: HTMLElement;

  function render(tooltip: boolean): void {
    fixture = TestBed.createComponent(NutrientPetalsComponent);
    fixture.componentRef.setInput('nutrients', [tile('VIT_D', 'Vitamin D', 5.1, 15, 'µg'), tile('IRON', 'Iron', 12.3, 10), tile('ZINC', 'Zinc', null, 11)]);
    fixture.componentRef.setInput('reached', 1);
    fixture.componentRef.setInput('total', 3);
    fixture.componentRef.setInput('tooltip', tooltip);
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
  }
  const petals = () => Array.from(host.querySelectorAll<SVGPathElement>('path.live'));
  const lines = () => Array.from(host.querySelectorAll('.tip > *')).map((line) => (line.textContent ?? '').trim());

  it('writes three lines per nutrient: name, amounts and share', () => {
    expect(petalTip(tile('VIT_D', 'Vitamin D', 5.1, 15, 'µg'))).toEqual(jasmine.objectContaining({ name: 'Vitamin D', amounts: '5.1 µg a day of 15 µg', share: '34% of the daily amount', under: true }));
    expect(petalTip(tile('IRON', 'Iron', 12.3, 10)).share).toBe('123% of the daily amount');
    expect(petalTip(tile('IRON', 'Iron', 12.3, 10)).under).toBeFalse();
    expect(petalTip(tile('NA', 'Sodium', 1234, 2300)).amounts).toBe('1,234 mg a day of 2,300 mg');
  });

  it('is off by default: no focusable petals', () => {
    render(false);
    expect(petals().length).toBe(0);
    expect(host.querySelector('[tabindex]')).toBeNull();
  });

  it('opens on keyboard focus with the nutrient, dims the others and is spoken the same', () => {
    render(true);
    expect(petals().length).toBe(2);
    expect(petals()[0].getAttribute('tabindex')).toBe('0');
    expect(petals()[0].getAttribute('role')).toBe('img');
    expect(petals()[0].getAttribute('aria-label')).toBe('Vitamin D, 5.1 µg a day of 15 µg, 34% of the daily amount');
    petals()[0].dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(lines()).toEqual(['Vitamin D', '5.1 µg a day of 15 µg', '34% of the daily amount']);
    expect(host.querySelector('.tip span.amber')?.textContent).toContain('34%');
    expect(petals()[0].getAttribute('fill-opacity')).toBe('1');
    expect(petals()[1].getAttribute('fill-opacity')).toBe('0.6');
    petals()[0].dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();
    expect(host.querySelector('.tip')).toBeNull();
  });

  it('shows a share at or over 100% in slate', () => {
    render(true);
    petals()[1].dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(lines()[2]).toBe('123% of the daily amount');
    expect(host.querySelector('.tip span.amber')).toBeNull();
  });

  it('opens on hover and on a tap, and closes on Escape and on a tap elsewhere', () => {
    render(true);
    petals()[0].dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(host.querySelector('.tip')).not.toBeNull();
    petals()[0].dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(host.querySelector('.tip')).toBeNull();

    petals()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    expect(lines()[0]).toBe('Iron');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(host.querySelector('.tip')).toBeNull();

    petals()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(host.querySelector('.tip')).toBeNull();
  });
});
