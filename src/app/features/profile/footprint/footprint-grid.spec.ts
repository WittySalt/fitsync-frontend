import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FOOTPRINT, TODAY, days } from '../../../core/me-fixtures.spec';
import { Footprint } from '../../../core/me.models';
import { FootprintGridComponent } from './footprint-grid.component';
import { MIN_WEEKS, buildFootprintGrid, mondayOf } from './footprint-grid';

describe('footprint grid', () => {
  describe('buildFootprintGrid', () => {
    const grid = buildFootprintGrid(FOOTPRINT, TODAY);

    it('has one column of seven cells for each week from the first Monday, never fewer than 52', () => {
      expect(grid.columns.length).toBe(MIN_WEEKS);
      expect(grid.columns.every((column) => column.cells.length === 7)).toBeTrue();
      expect(grid.columns[0].monday).toBe('2026-08-03');
      expect(grid.columns[1].monday).toBe('2026-08-10');
    });

    it('starts every column on a Monday', () => {
      expect(grid.columns.every((column) => mondayOf(column.monday) === column.monday)).toBeTrue();
    });

    it('marks trained, logged, both, empty and future cells', () => {
      const state = (date: string) => grid.columns.flatMap((column) => column.cells).find((cell) => cell.date === date)?.state;
      expect(state('2026-08-03')).toBe('empty');
      expect(state('2026-08-04')).toBe('logged');
      expect(state('2026-09-21')).toBe('both');
      expect(state('2026-08-08')).toBe('empty');
      expect(state('2026-10-07')).toBe('future');
    });

    it('outlines today and no other day, in the column of its week', () => {
      const todays = grid.columns.flatMap((column) => column.cells).filter((cell) => cell.today);
      expect(todays.map((cell) => cell.date)).toEqual([TODAY]);
      expect(grid.columns[grid.todayColumn].monday).toBe('2026-10-05');
      expect(grid.columns[grid.todayColumn].cells[1].today).toBeTrue();
    });

    it('labels the months where they begin', () => {
      expect(grid.months.slice(0, 3)).toEqual([
        { column: 0, label: 'Aug' },
        { column: 5, label: 'Sep' },
        { column: 9, label: 'Oct' }
      ]);
    });

    it('grows past 52 weeks for a longer membership so the page can scroll', () => {
      const long: Footprint = { ...FOOTPRINT, from: '2025-08-04', memberSince: '2025-08-04', days: days('2025-08-04', TODAY) };
      const wide = buildFootprintGrid(long, TODAY);
      expect(wide.columns.length).toBe(milestoneWeeks('2025-08-04', TODAY));
      expect(wide.columns.length).toBeGreaterThan(MIN_WEEKS);
      expect(wide.todayColumn).toBe(wide.columns.length - 1);
    });

    it('returns nothing for a day that is not a date', () => {
      expect(buildFootprintGrid(FOOTPRINT, '').columns).toEqual([]);
    });
  });
});

function milestoneWeeks(from: string, today: string): number {
  return Math.floor((Date.parse(`${mondayOf(today)}T00:00:00Z`) - Date.parse(`${mondayOf(from)}T00:00:00Z`)) / (7 * 86_400_000)) + 1;
}

describe('FootprintGridComponent', () => {
  let fixture: ComponentFixture<FootprintGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FootprintGridComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(FootprintGridComponent);
    fixture.componentRef.setInput('footprint', FOOTPRINT);
    fixture.componentRef.setInput('today', TODAY);
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;

  it('draws 364 cells at least 8 pixels wide', () => {
    const cells = root().querySelectorAll('rect.cell');
    expect(cells.length).toBe(52 * 7);
    expect(Number(cells[0].getAttribute('width'))).toBeGreaterThanOrEqual(8);
    expect(cells[0].getAttribute('height')).toBe(cells[0].getAttribute('width'));
  });

  it('draws one outline, for today, and a dot on each day with both', () => {
    expect(root().querySelectorAll('rect.today').length).toBe(1);
    expect(root().querySelectorAll('circle.dot').length).toBe(root().querySelectorAll('rect.cell.both').length);
    expect(root().querySelectorAll('rect.cell.both').length).toBeGreaterThan(0);
  });

  it('writes the month labels and opens the Training log', () => {
    expect(Array.from(root().querySelectorAll('text.month')).map((label) => label.textContent).slice(0, 3)).toEqual(['Aug', 'Sep', 'Oct']);
    const link = root().querySelector('a');
    expect(link?.getAttribute('href')).toBe('/progress/training#log');
    expect(link?.getAttribute('aria-label')).toContain('31 workouts, 58 days with meals logged, 7 badges');
  });
});
