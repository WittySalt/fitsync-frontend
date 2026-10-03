import { ComponentFixture, TestBed } from '@angular/core/testing';

import { isValidRange, rangeForDays, sameRange, shiftKey } from './progress-range';
import { ProgressRangeComponent } from './progress-range.component';

describe('progress range helpers', () => {
  it('moves a day key by whole days across months and years', () => {
    expect(shiftKey('2026-10-03', -90)).toBe('2026-07-05');
    expect(shiftKey('2026-01-02', -3)).toBe('2025-12-30');
    expect(shiftKey('2026-02-27', 3)).toBe('2026-03-02');
  });

  it('ends the range on today and starts the given number of days before', () => {
    expect(rangeForDays(30, '2026-10-03')).toEqual({ from: '2026-09-03', to: '2026-10-03' });
    expect(rangeForDays(365, '2026-10-03')).toEqual({ from: '2025-10-03', to: '2026-10-03' });
  });

  it('compares ranges by their days', () => {
    expect(sameRange({ from: 'a', to: 'b' }, { from: 'a', to: 'b' })).toBeTrue();
    expect(sameRange({ from: 'a', to: 'b' }, { from: 'a', to: 'c' })).toBeFalse();
  });

  it('accepts a range with two dates in order and nothing else', () => {
    expect(isValidRange({ from: '2026-08-01', to: '2026-08-31' })).toBeTrue();
    expect(isValidRange({ from: '2026-08-01', to: '2026-08-01' })).toBeTrue();
    expect(isValidRange({ from: '2026-09-01', to: '2026-08-31' })).toBeFalse();
    expect(isValidRange({ from: '', to: '2026-08-31' })).toBeFalse();
  });
});

describe('ProgressRangeComponent', () => {
  let fixture: ComponentFixture<ProgressRangeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProgressRangeComponent] }).compileComponents();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-03T04:00:00Z'));
    fixture = TestBed.createComponent(ProgressRangeComponent);
    fixture.componentRef.setInput('range', { from: '2026-07-05', to: '2026-10-03' });
    fixture.componentRef.setInput('activeDays', 90);
    fixture.detectChanges();
  });

  afterEach(() => jasmine.clock().uninstall());

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('offers 30 days, 90 days and 1 year and fills the one in use', () => {
    const buttons = Array.from(root().querySelectorAll<HTMLButtonElement>('.presets button'));

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['30 days', '90 days', '1 year']);
    expect(buttons.map((button) => button.classList.contains('active'))).toEqual([false, true, false]);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('names the range in the short date style', () => {
    expect(root().querySelector('.caption')?.textContent?.trim()).toBe('5 Jul to 3 Oct');
  });

  it('tells the page which preset was chosen', () => {
    const chosen: number[] = [];
    fixture.componentInstance.presetChosen.subscribe((days) => chosen.push(days));

    root().querySelectorAll<HTMLButtonElement>('.presets button')[2].click();

    expect(chosen).toEqual([365]);
  });

  it('selects no preset while a custom range is in use', () => {
    fixture.componentRef.setInput('activeDays', null);
    fixture.detectChanges();

    expect(root().querySelector('.presets button.active')).toBeNull();
  });

  it('keeps the custom dates behind More, opened with the current range', () => {
    expect(root().querySelector('input[type="date"]')).toBeNull();

    const more = root().querySelector<HTMLButtonElement>('.more');
    more?.click();
    fixture.detectChanges();

    expect(more?.getAttribute('aria-expanded')).toBe('true');
    const inputs = Array.from(root().querySelectorAll<HTMLInputElement>('input[type="date"]'));
    expect(inputs.map((input) => input.value)).toEqual(['2026-07-05', '2026-10-03']);
  });

  it('applies a custom range only when it is valid', () => {
    const chosen: { from: string; to: string }[] = [];
    fixture.componentInstance.customChosen.subscribe((range) => chosen.push(range));
    root().querySelector<HTMLButtonElement>('.more')?.click();
    fixture.detectChanges();

    fixture.componentInstance.from.set('2026-09-01');
    fixture.componentInstance.to.set('2026-08-01');
    fixture.detectChanges();
    expect(root().querySelector('.problem')?.textContent).toContain('start has to come before the end');
    expect(root().querySelector<HTMLButtonElement>('.custom .button')?.disabled).toBeTrue();
    fixture.componentInstance.apply();
    expect(chosen).toEqual([]);

    fixture.componentInstance.to.set('2026-09-30');
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('.custom .button')?.click();
    expect(chosen).toEqual([{ from: '2026-09-01', to: '2026-09-30' }]);
  });
});
