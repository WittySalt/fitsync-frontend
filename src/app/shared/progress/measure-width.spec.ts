import { Component, ElementRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { measureWidth } from './measure-width';

@Component({
  selector: 'app-measure-probe',
  template: '<span>{{ width() }}</span>',
  styles: ':host { display: block; }'
})
class ProbeComponent {
  readonly host = inject(ElementRef<HTMLElement>);
  readonly width = measureWidth(111);
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('measureWidth', () => {
  it('starts at the fallback, then holds the host width in pixels', async () => {
    const fixture = TestBed.createComponent(ProbeComponent);
    (fixture.nativeElement as HTMLElement).style.width = '240px';
    expect(fixture.componentInstance.width()).toBe(111);
    fixture.detectChanges();
    await fixture.whenStable();
    await frame();
    expect(fixture.componentInstance.width()).toBe(240);
  });

  it('follows the host when it is resized', async () => {
    const fixture = TestBed.createComponent(ProbeComponent);
    const host = fixture.nativeElement as HTMLElement;
    host.style.width = '300px';
    fixture.detectChanges();
    await frame();
    host.style.width = '180px';
    await frame();
    await frame();
    expect(fixture.componentInstance.width()).toBe(180);
  });

  it('keeps the fallback while the host has no width', async () => {
    const fixture = TestBed.createComponent(ProbeComponent);
    (fixture.nativeElement as HTMLElement).style.display = 'none';
    fixture.detectChanges();
    await frame();
    expect(fixture.componentInstance.width()).toBe(111);
  });
});
