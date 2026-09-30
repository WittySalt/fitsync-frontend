import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AdminApiService, CoachQuality } from './admin-api.service';
import { CoachQualityPage } from './coach-quality.page';

const fullResponse: CoachQuality = {
  from: '2026-09-24',
  to: '2026-09-30',
  timezone: 'Asia/Singapore',
  answers: {
    total: 42,
    passed: 30,
    rejected: 4,
    refused: 3,
    modelUnavailable: 5,
    other: 0,
    rejectedByRule: [
      { rule: 'WEEK_NOT_NAMED', count: 1 },
      { rule: 'NUMBER_NOT_IN_RECORDS', count: 2 },
      { rule: 'DIRECTION_NOT_IN_FACTS', count: 1 }
    ],
    refusedByRule: [
      { rule: 'CALORIE_FLOOR', count: 2 },
      { rule: 'OUT_OF_SCOPE', count: 1 }
    ]
  },
  latency: { count: 30, medianMs: 2600, p95Ms: 7449 },
  tiers: [{ tier: 'STANDARD', count: 30 }],
  models: [{ model: 'claude-haiku-4-5', count: 30 }],
  tools: [
    { tool: 'readFacts', calls: 40, failed: 0, medianMs: 14 },
    { tool: 'readRecentTraining', calls: 22, failed: 0, medianMs: 12 },
    { tool: 'readPinnedReading', calls: 16, failed: 0, medianMs: 1 },
    { tool: 'searchExercises', calls: 6, failed: 0, medianMs: 10 }
  ],
  readings: [
    { surface: 'WORKOUT', source: 'MODEL', outcome: 'ACCEPTED', count: 6 },
    { surface: 'WORKOUT', source: 'MODEL', outcome: 'REJECTED', count: 1 },
    { surface: 'WORKOUT', source: 'RULES', outcome: 'ACCEPTED', count: 9 }
  ],
  daily: [
    { date: '2026-09-24', answers: 5, passed: 4, rejected: 1, refused: 0, modelUnavailable: 0 },
    { date: '2026-09-25', answers: 6, passed: 5, rejected: 0, refused: 1, modelUnavailable: 0 },
    { date: '2026-09-26', answers: 3, passed: 3, rejected: 0, refused: 0, modelUnavailable: 0 },
    { date: '2026-09-27', answers: 2, passed: 2, rejected: 0, refused: 0, modelUnavailable: 0 },
    { date: '2026-09-28', answers: 8, passed: 6, rejected: 1, refused: 1, modelUnavailable: 0 },
    { date: '2026-09-29', answers: 15, passed: 7, rejected: 2, refused: 1, modelUnavailable: 5 },
    { date: '2026-09-30', answers: 3, passed: 3, rejected: 0, refused: 0, modelUnavailable: 0 }
  ]
};

const emptyResponse: CoachQuality = {
  from: '2026-09-24',
  to: '2026-09-30',
  timezone: 'Asia/Singapore',
  answers: { total: 0, passed: 0, rejected: 0, refused: 0, modelUnavailable: 0, other: 0, rejectedByRule: [], refusedByRule: [] },
  latency: { count: 0, medianMs: 0, p95Ms: 0 },
  tiers: [],
  models: [],
  tools: [],
  readings: [],
  daily: []
};

describe('CoachQualityPage', () => {
  let fixture: ComponentFixture<CoachQualityPage>;
  let api: jasmine.SpyObj<AdminApiService>;

  function create(response: Observable<CoachQuality>): HTMLElement {
    api.getCoachQuality.and.returnValue(response);
    fixture = TestBed.createComponent(CoachQualityPage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  // Angular drops the whitespace between elements, so the pieces of text are joined with a space.
  function text(element: Element | null | undefined): string {
    const pieces: string[] = [];
    const walker = document.createTreeWalker(element ?? document.createElement('div'), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const piece = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (piece) {
        pieces.push(piece);
      }
    }
    return pieces.join(' ');
  }

  beforeEach(async () => {
    // Noon UTC is the same calendar day in every timezone from UTC-11 to UTC+11.
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-30T12:00:00Z'));
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', ['getCoachQuality']);
    await TestBed.configureTestingModule({
      imports: [CoachQualityPage],
      providers: [{ provide: AdminApiService, useValue: api }]
    }).compileComponents();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('shows skeleton blocks while the numbers load', () => {
    const element = create(new Subject<CoachQuality>());

    expect(element.querySelector('.skeleton-page')?.getAttribute('role')).toBe('status');
    expect(element.querySelectorAll('.tile.skeleton').length).toBe(5);
    expect(element.querySelector('.tile:not(.skeleton)')).toBeNull();
    expect(text(element.querySelector('h1'))).toBe('Coach quality');
  });

  it('states what the page holds and does not hold', () => {
    const element = create(of(fullResponse));

    expect(text(element.querySelector('.page-title p'))).toBe('Counts and rule names only. No question, answer or user appears on this page.');
  });

  it('renders the five tiles with their counts and shares', () => {
    const element = create(of(fullResponse));

    const tiles = Array.from(element.querySelectorAll('.tile')).map((tile) => text(tile));
    expect(tiles).toEqual(['Answers 42 in 7 days', 'Passed 30 71%', 'Rejected 4 10%', 'Refused 3 7%', 'Model unavailable 5 12%']);
  });

  it('draws one stacked bar per day with the total above and the date below', () => {
    const element = create(of(fullResponse));

    const days = Array.from(element.querySelectorAll('.day'));
    expect(days.length).toBe(7);
    expect(days.map((day) => text(day.querySelector('.day-total')))).toEqual(['5', '6', '3', '2', '8', '15', '3']);
    expect(days.map((day) => text(day.querySelector('.day-label')))).toEqual([
      '24 Sept',
      '25 Sept',
      '26 Sept',
      '27 Sept',
      '28 Sept',
      '29 Sept',
      '30 Sept'
    ]);
    const tallest = Array.from(days[5].querySelectorAll<HTMLElement>('.segment'));
    expect(tallest.map((segment) => [segment.dataset['kind'], segment.style.height])).toEqual([
      ['passed', '78px'],
      ['rejected', '22px'],
      ['refused', '11px'],
      ['unavailable', '56px']
    ]);
    expect(text(element.querySelector('#answers-by-day + .note'))).toBe('24 to 30 Sept');
    expect(text(element.querySelector('.legend'))).toBe('Passed Rejected Refused Model unavailable');
  });

  it('gives the chart a text alternative listing the daily totals', () => {
    const element = create(of(fullResponse));

    expect(element.querySelector('.strip')?.getAttribute('aria-label')).toBe(
      'Answers by day: 24 Sept 5, 25 Sept 6, 26 Sept 3, 27 Sept 2, 28 Sept 8, 29 Sept 15, 30 Sept 3.'
    );
  });

  it('lists the rules by count with bars sized against the largest', () => {
    const element = create(of(fullResponse));

    const rows = Array.from(element.querySelectorAll('.rule-row'));
    expect(rows.map((row) => text(row))).toEqual([
      'NUMBER_NOT_IN_RECORDS 2',
      'DIRECTION_NOT_IN_FACTS 1',
      'WEEK_NOT_NAMED 1',
      'CALORIE_FLOOR 2',
      'OUT_OF_SCOPE 1'
    ]);
    expect(rows.map((row) => row.querySelector<HTMLElement>('.rule-fill')?.style.width)).toEqual(['100%', '50%', '50%', '100%', '50%']);
    expect(text(element.querySelector('#why-rejected + .note'))).toBe('4 rejected, 3 refused');
    expect(text(element.querySelector('h3'))).toBe('Why the coach refused');
  });

  it('shows the time to answer and the model', () => {
    const element = create(of(fullResponse));

    const panel = element.querySelector('[aria-labelledby="time-to-answer"]');
    expect(text(panel)).toBe('Time to answer Passed only Median 2.6 s 95th percentile 7.4 s 30 passed answers, all from claude-haiku-4-5');
  });

  it('shows the tool table with its note', () => {
    const element = create(of(fullResponse));

    const panel = element.querySelector('[aria-labelledby="tool-calls"]');
    expect(text(panel?.querySelector('.note'))).toBe('84 calls, none failed');
    expect(Array.from(panel?.querySelectorAll('thead th') ?? []).map((cell) => text(cell))).toEqual(['Tool', 'Calls', 'Failed', 'Median']);
    const rows = Array.from(panel?.querySelectorAll('tbody tr') ?? []).map((row) => text(row));
    expect(rows).toEqual([
      'readFacts 40 0 14 ms',
      'readRecentTraining 22 0 12 ms',
      'readPinnedReading 16 0 1 ms',
      'searchExercises 6 0 10 ms'
    ]);
  });

  it('pivots the readings into accepted and rejected columns', () => {
    const element = create(of(fullResponse));

    const panel = element.querySelector('[aria-labelledby="readings-on-pages"]');
    expect(text(panel?.querySelector('.note'))).toBe('16 readings');
    expect(Array.from(panel?.querySelectorAll('thead th') ?? []).map((cell) => text(cell))).toEqual(['Page and writer', 'Accepted', 'Rejected']);
    expect(Array.from(panel?.querySelectorAll('tbody tr') ?? []).map((row) => text(row))).toEqual([
      'Workout, coach model 6 1',
      'Workout, fixed rules 9 0'
    ]);
  });

  it('shows zeros and the empty lines when there were no answers', () => {
    const element = create(of(emptyResponse));

    const tiles = Array.from(element.querySelectorAll('.tile')).map((tile) => text(tile));
    expect(tiles).toEqual(['Answers 0 in 7 days', 'Passed 0 0%', 'Rejected 0 0%', 'Refused 0 0%', 'Model unavailable 0 0%']);
    expect(text(element.querySelector('[aria-labelledby="answers-by-day"]'))).toContain('No answers in this period.');
    expect(Array.from(element.querySelectorAll('[aria-labelledby="why-rejected"] .empty')).map((line) => text(line))).toEqual([
      'None in this period.',
      'None in this period.'
    ]);
    expect(text(element.querySelector('[aria-labelledby="time-to-answer"]'))).toContain('No passed answers in this period.');
    expect(text(element.querySelector('[aria-labelledby="time-to-answer"]'))).not.toContain(' s ');
    expect(text(element.querySelector('[aria-labelledby="tool-calls"]'))).toContain('No tool calls in this period.');
    expect(text(element.querySelector('[aria-labelledby="readings-on-pages"]'))).toContain('No readings in this period.');
  });

  it('shows the error state with a retry that loads again', () => {
    const element = create(throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(text(element.querySelector('[role="alert"]'))).toContain('The numbers could not be loaded.');
    const retry = element.querySelector<HTMLButtonElement>('.retry');
    expect(text(retry)).toBe('Try again');

    api.getCoachQuality.calls.reset();
    api.getCoachQuality.and.returnValue(of(fullResponse));
    retry?.click();
    fixture.detectChanges();

    expect(api.getCoachQuality).toHaveBeenCalledTimes(1);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(text(element.querySelector('.tile'))).toBe('Answers 42 in 7 days');
  });

  it('tells a member the page is for administrators and offers no retry', () => {
    const element = create(throwError(() => new HttpErrorResponse({ status: 403 })));

    expect(text(element.querySelector('[role="alert"]'))).toBe('This page is for administrators.');
    expect(element.querySelector('.retry')).toBeNull();
    expect(element.querySelector('.tile')).toBeNull();
  });

  it('asks for the last seven days ending today by default', () => {
    create(of(fullResponse));

    const [from, to, timezone] = api.getCoachQuality.calls.mostRecent().args;
    expect([from, to]).toEqual(['2026-09-24', '2026-09-30']);
    expect(timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('marks the selected period with aria-pressed and reloads when it changes', () => {
    const element = create(of(fullResponse));
    const buttons = Array.from(element.querySelectorAll<HTMLButtonElement>('.period button'));
    expect(buttons.map((button) => text(button))).toEqual(['7 days', '30 days', '90 days']);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);

    buttons[1].click();
    fixture.detectChanges();

    let [from, to] = api.getCoachQuality.calls.mostRecent().args;
    expect([from, to]).toEqual(['2026-09-01', '2026-09-30']);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    expect(text(element.querySelector('.tile'))).toBe('Answers 42 in 30 days');

    buttons[2].click();
    fixture.detectChanges();

    [from, to] = api.getCoachQuality.calls.mostRecent().args;
    expect([from, to]).toEqual(['2026-07-03', '2026-09-30']);
    expect(api.getCoachQuality).toHaveBeenCalledTimes(3);
  });

  it('does not reload when the selected period is chosen again', () => {
    const element = create(of(fullResponse));

    element.querySelector<HTMLButtonElement>('.period button')?.click();

    expect(api.getCoachQuality).toHaveBeenCalledTimes(1);
  });

  it('labels every seventh date on a longer range', () => {
    const daily = Array.from({ length: 30 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      answers: 1,
      passed: 1,
      rejected: 0,
      refused: 0,
      modelUnavailable: 0
    }));
    const element = create(of({ ...fullResponse, daily }));

    const labels = Array.from(element.querySelectorAll('.day-label')).map((label) => text(label));
    expect(labels.length).toBe(30);
    expect(labels.filter(Boolean)).toEqual(['1 Sept', '8 Sept', '15 Sept', '22 Sept', '29 Sept']);
  });
});
