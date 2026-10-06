import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';

import { useFragmentScroll } from './fragment-scroll';

const ready = signal(false);

@Component({
  selector: 'app-fragment-host',
  template: '<section id="muscles"></section>'
})
class HostComponent {
  protected readonly scroll = useFragmentScroll(ready);
}

describe('useFragmentScroll', () => {
  let scrolled: string[];

  function mount(fragment: string | null): void {
    TestBed.configureTestingModule({ providers: [{ provide: ActivatedRoute, useValue: { snapshot: { fragment } } }] });
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    ready.set(true);
    fixture.detectChanges();
    TestBed.tick();
    fixture.nativeElement.remove();
  }

  beforeEach(() => {
    ready.set(false);
    scrolled = [];
    spyOn(Element.prototype, 'scrollIntoView').and.callFake(function (this: Element) {
      scrolled.push(this.id);
    });
  });

  it('scrolls to the section the address names once the page has its data', () => {
    mount('muscles');
    expect(scrolled).toEqual(['muscles']);
  });

  it('does nothing without a fragment', () => {
    mount(null);
    expect(scrolled).toEqual([]);
  });
});
