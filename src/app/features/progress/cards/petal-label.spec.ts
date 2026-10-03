import { TestBed } from '@angular/core/testing';

import { NutrientPetalsComponent } from '../../nutrition/nutrients/nutrient-petals.component';

describe('the petals on the Food card', () => {
  it('label the dashed ring at 12 o\'clock inside the drawing, only when asked', () => {
    const draw = (label: string): SVGSVGElement => {
      const fixture = TestBed.createComponent(NutrientPetalsComponent);
      fixture.componentRef.setInput('nutrients', []);
      fixture.componentRef.setInput('reached', 17);
      fixture.componentRef.setInput('total', 19);
      fixture.componentRef.setInput('ringLabel', label);
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    };
    const svg = draw('100%');
    const label = svg.querySelector('.ring-label') as SVGTextElement;
    expect(label.textContent?.trim()).toBe('100%');
    expect(Number(label.getAttribute('y'))).toBeGreaterThan(0);
    expect(Number(label.getAttribute('y'))).toBeLessThan(145);
    expect(svg.textContent).toContain('17/19');
    expect(draw('').querySelector('.ring-label')).toBeNull();
  });
});
