import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recommendation } from '../../core/coach/coach.models';
import { RecommendationCardComponent, factChips, relativeTime } from './recommendation-card.component';

describe('factChips', () => {
  it('turns scalar facts into short labelled chips, in server order', () => {
    expect(
      factChips({ caloriesConsumed: 2037, caloriesTarget: 2100, proteinGrams: 158.5, onTrack: true, basis: 'ENERGY_PROFILE' })
    ).toEqual([
      'calories consumed 2037',
      'calories target 2100',
      'protein grams 158.5',
      'on track yes',
      'basis energy profile'
    ]);
  });

  it('skips nulls and nested structures, which are for the model rather than the person', () => {
    expect(factChips({ a: null, b: { nested: 1 }, c: [1, 2], d: 3 })).toEqual(['d 3']);
  });

  it('caps at five chips so a card stays a card', () => {
    expect(factChips({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }).length).toBe(5);
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-09-26T12:00:00Z');

  it('describes how long ago something was generated', () => {
    expect(relativeTime('2026-09-26T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-09-26T11:45:00Z', now)).toBe('15m ago');
    expect(relativeTime('2026-09-26T09:00:00Z', now)).toBe('3h ago');
    expect(relativeTime('2026-09-24T12:00:00Z', now)).toBe('2d ago');
  });

  it('is empty for a missing or unreadable time rather than inventing one', () => {
    expect(relativeTime(undefined, now)).toBe('');
    expect(relativeTime('not a date', now)).toBe('');
  });
});

describe('RecommendationCardComponent', () => {
  let fixture: ComponentFixture<RecommendationCardComponent>;

  const recommendation: Recommendation = {
    type: 'NUTRITION_GAP',
    source: 'RULE',
    facts: { caloriesConsumed: 2037, caloriesTarget: 2100 },
    narrative: "You have 63 kcal left of today's 2100 kcal target.",
    generatedAt: '2026-10-06T09:58:00Z',
    expiresAt: null
  };

  beforeEach(async () => {
    // A fixed clock: the freshness line is "2m ago" however long the suite has been running.
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-06T10:00:00Z'));
    await TestBed.configureTestingModule({ imports: [RecommendationCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(RecommendationCardComponent);
    fixture.componentRef.setInput('recommendation', recommendation);
    fixture.detectChanges();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('shows the sentence, the facts it came from, its source and its freshness together', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain("You have 63 kcal left");
    expect(text).toContain('calories consumed 2037');
    expect(text).toContain('RULE');
    expect(text).toContain('2m ago');
    expect(text).toContain('nutrition gap');
  });

  it('emits the recommendation when asked about', () => {
    const emitted: Recommendation[] = [];
    fixture.componentInstance.ask.subscribe((r) => emitted.push(r));

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.rec-btn')?.click();

    expect(emitted).toEqual([recommendation]);
  });

  it('marks an AI card so the user knows which is which', () => {
    fixture.componentRef.setInput('recommendation', { ...recommendation, source: 'AI', type: 'WEEKLY_NARRATIVE' });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.rec-card.ai')).not.toBeNull();
  });
});
