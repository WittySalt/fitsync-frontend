import { TestBed } from '@angular/core/testing';

import { PagerComponent, pagerItems } from './pager.component';

describe('pagerItems', () => {
  it('lists every page up to seven', () => {
    expect(pagerItems(0, 1)).toEqual([0]);
    expect(pagerItems(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('keeps the first pages together near the start', () => {
    expect(pagerItems(0, 20)).toEqual([0, 1, 2, 3, 4, 'gap', 19]);
    expect(pagerItems(3, 20)).toEqual([0, 1, 2, 3, 4, 'gap', 19]);
  });

  it('keeps the last pages together near the end', () => {
    expect(pagerItems(19, 20)).toEqual([0, 'gap', 15, 16, 17, 18, 19]);
    expect(pagerItems(16, 20)).toEqual([0, 'gap', 15, 16, 17, 18, 19]);
  });

  it('shows the current page and its neighbours in the middle', () => {
    expect(pagerItems(9, 20)).toEqual([0, 'gap', 8, 9, 10, 'gap', 19]);
  });
});

describe('PagerComponent', () => {
  function render(page: number, totalPages: number) {
    const fixture = TestBed.createComponent(PagerComponent);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('totalPages', totalPages);
    fixture.componentRef.setInput('total', totalPages * 10);
    fixture.componentRef.setInput('unit', 'sessions');
    fixture.componentRef.setInput('pageSize', 10);
    fixture.componentRef.setInput('pageSizes', [10, 20, 50]);
    fixture.detectChanges();
    const pages: number[] = [];
    const sizes: number[] = [];
    fixture.componentInstance.pageChange.subscribe((value) => pages.push(value));
    fixture.componentInstance.pageSizeChange.subscribe((value) => sizes.push(value));
    return { fixture, element: fixture.nativeElement as HTMLElement, pages, sizes };
  }

  it('marks the current page and moves with Previous and Next', () => {
    const { element, pages } = render(1, 3);
    const current = element.querySelector('.number.current');

    expect(current?.textContent?.trim()).toBe('2');
    expect(current?.getAttribute('aria-current')).toBe('page');
    element.querySelector<HTMLButtonElement>('.prev')?.click();
    element.querySelector<HTMLButtonElement>('.next')?.click();
    expect(pages).toEqual([0, 2]);
  });

  it('disables Previous on the first page and Next on the last', () => {
    expect(render(0, 3).element.querySelector<HTMLButtonElement>('.prev')?.disabled).toBeTrue();
    expect(render(2, 3).element.querySelector<HTMLButtonElement>('.next')?.disabled).toBeTrue();
  });

  it('does not emit for the page already shown', () => {
    const { element, pages } = render(1, 3);

    element.querySelector<HTMLButtonElement>('.number.current')?.click();
    expect(pages).toEqual([]);
  });

  it('offers the jump box only when some pages are hidden', () => {
    expect(render(0, 7).element.querySelector('.jump input')).toBeNull();
    expect(render(0, 8).element.querySelector('.jump input')).not.toBeNull();
  });

  it('jumps to a typed page and keeps it inside the range', () => {
    const { element, pages } = render(0, 20);
    const box = element.querySelector<HTMLInputElement>('.jump input')!;

    box.value = '12';
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    box.value = '99';
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    box.value = 'x';
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(pages).toEqual([11, 19]);
    expect(box.value).toBe('');
  });

  it('emits a new page size only for an offered size', () => {
    const { element, sizes } = render(0, 3);
    const select = element.querySelector<HTMLSelectElement>('select')!;

    select.value = '20';
    select.dispatchEvent(new Event('change'));
    select.value = '10';
    select.dispatchEvent(new Event('change'));

    expect(sizes).toEqual([20]);
  });

  it('shows only the total when there is one page', () => {
    const { element } = render(0, 1);

    expect(element.textContent).toContain('10 sessions');
    expect(element.querySelector('.pages')).toBeNull();
  });
});
