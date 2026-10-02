import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DiaryWeekComponent } from './diary-week.component';
import { RangeDay } from './diary.models';
import { rangeDay } from './diary-testing.spec';
import { weekOf } from './diary-time';

const TODAY = '2026-10-02';
const DATES = weekOf(TODAY);

@Component({
  imports: [DiaryWeekComponent],
  template: `
    <app-diary-week
      [days]="days"
      [dates]="dates"
      [today]="today"
      [selected]="selected"
      [target]="2100"
      [failed]="failed"
      (pick)="picked = $event"
      (retry)="retried = retried + 1"
    />
  `
})
class HostComponent {
  days: RangeDay[] = [
    rangeDay('2026-09-28', { totalCalories: 2050 }),
    rangeDay('2026-09-29', { totalCalories: 1980 }),
    rangeDay('2026-09-30', { totalCalories: 2280 }),
    rangeDay('2026-10-01', { totalCalories: 1720 }),
    rangeDay(TODAY, { totalCalories: 900 })
  ];
  dates = DATES;
  today = TODAY;
  selected = TODAY;
  failed = false;
  picked = '';
  retried = 0;
}

describe('DiaryWeekComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('draws seven day tiles with the weekday names Monday first', () => {
    const labels = Array.from<HTMLElement>(render().nativeElement.querySelectorAll('.weekday')).map((node) => node.textContent?.trim());
    expect(labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('fills a tile by calories over the target and says Today for today', () => {
    const fixture = render();
    const fills = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.fill'));
    expect(parseFloat(fills[0].style.height)).toBeCloseTo((2050 / 2100) * 100, 0);
    expect(parseFloat(fills[5].style.height)).toBe(0);
    const captions = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.caption')).map((node) => node.textContent?.trim());
    expect(captions[0]).toBe('2,050');
    expect(captions[4]).toBe('Today');
  });

  it('shows kcal under every past day with data, in bold ink only for a day far from its target', () => {
    const captions = Array.from<HTMLElement>(render().nativeElement.querySelectorAll('.caption'));
    expect(captions.map((node) => node.textContent?.trim())).toEqual(['2,050', '1,980', '2,280', '1,720', 'Today', '', '']);
    expect(captions.map((node) => node.classList.contains('far'))).toEqual([false, false, false, true, false, false, false]);
  });

  it('shows days logged, days on target and kcal a day', () => {
    const figures = Array.from<HTMLElement>(render().nativeElement.querySelectorAll('.figure')).map((node) => Array.from(node.children).map((child) => child.textContent?.trim()).join(' '));
    expect(figures).toEqual(['4 of 4 days logged', '3 on target', '2,008 kcal a day']);
  });

  it('shows the range of the week', () => {
    expect(render().nativeElement.querySelector('.range')?.textContent).toMatch(/^28 Sep\w* to 4 Oct$/);
  });

  it('marks the shown day and shows another one when a tile is tapped', () => {
    const fixture = render();
    const buttons = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('.day'));
    expect(buttons[4].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    buttons[1].click();
    expect(fixture.componentInstance.picked).toBe('2026-09-29');
  });

  it('describes each tile for a screen reader', () => {
    const buttons = Array.from<HTMLButtonElement>(render().nativeElement.querySelectorAll('.day'));
    expect(buttons[0].getAttribute('aria-label')).toBe('Mon, 2,050 kcal. Show this day.');
    expect(buttons[5].getAttribute('aria-label')).toBe('Sat, nothing logged. Show this day.');
  });

  it('shows a retry in place of the tiles when the week failed', () => {
    const fixture = render();
    fixture.componentInstance.failed = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.days')).toBeNull();
    (fixture.nativeElement.querySelector('.failed button') as HTMLButtonElement).click();
    expect(fixture.componentInstance.retried).toBe(1);
  });
});
