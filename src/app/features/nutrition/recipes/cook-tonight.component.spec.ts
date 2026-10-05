import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';

import { CoachStore } from '../../../core/coach/coach.store';
import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { RecipesService } from './recipes.service';
import { COOK_CARD_PREFILL, TOMORROW_QUESTION, cookChips, cookHeadline, dinnerLine } from './cook-tonight';
import { CookTonightComponent } from './cook-tonight.component';
import { mapRecipeSuggestions } from './recipes-mappers';
import { RecipeSuggestions } from './recipes.models';
import { SUGGESTION_PAYLOADS, recipesServiceStub, suggestionsOf } from './recipes-testing.spec';

const fixtureOf = (state: string): RecipeSuggestions => mapRecipeSuggestions(SUGGESTION_PAYLOADS[state]);

describe('Cook for tonight text', () => {
  it('words the FITS headline by how much of the target was eaten', () => {
    expect(cookHeadline(fixtureOf('FITS'))).toBe('Room for a proper dinner tonight.');
    const light = suggestionsOf({ facts: { ...fixtureOf('FITS').facts, eatenKcal: 900, targetKcal: 2100 } });
    expect(cookHeadline(light)).toBe('Light day so far, dinner can be the big one tonight.');
  });

  it('words the other states as the spec has them', () => {
    expect(cookHeadline(fixtureOf('PROTEIN_ONLY'))).toBe('Protein is the one thing short today.');
    expect(cookHeadline(fixtureOf('NOTHING_LOGGED'))).toBe('Nothing logged today yet.');
    expect(cookHeadline(fixtureOf('PAST_TARGET'))).toBe("You're past today's target, a light option if you still cook.");
  });

  it('lists the facts as chips for each state, leaving out what the server did not send', () => {
    expect(cookChips(fixtureOf('FITS'))).toEqual(['620 kcal left', 'protein 41 g short', 'Iron lowest this week', 'you usually eat at 19:30']);
    expect(cookChips(fixtureOf('PROTEIN_ONLY'))).toEqual(['protein 41 g short', '620 kcal left']);
    expect(cookChips(fixtureOf('NOTHING_LOGGED'))).toEqual(['You usually eat dinner at 19:30', 'your most cooked this month']);
    expect(cookChips(fixtureOf('PAST_TARGET'))).toEqual(['2,340 of 2,100 kcal', 'protein met']);
    expect(cookChips(fixtureOf('DINNER_LOGGED'))).toEqual([]);
  });

  it('says protein is short on a past-target day that missed it, and does not claim a most cooked pick that was not', () => {
    const missed = suggestionsOf({ state: 'PAST_TARGET', facts: { ...fixtureOf('PAST_TARGET').facts, proteinMet: false, proteinShortGrams: 12 } });
    expect(cookChips(missed)).toEqual(['2,340 of 2,100 kcal', 'protein 12 g short']);
    const libraryPick = suggestionsOf({ state: 'NOTHING_LOGGED', suggestions: [{ ...fixtureOf('FITS').suggestions[0], reason: 'A light start' }] });
    expect(cookChips(libraryPick)).toEqual(['You usually eat dinner at 19:30']);
  });

  it('folds to one line once dinner is logged', () => {
    expect(dinnerLine(fixtureOf('DINNER_LOGGED'))).toBe('Dinner logged · 2,010 of 2,100 kcal');
  });
});

describe('CookTonightComponent', () => {
  let data: jasmine.SpyObj<FitSyncDataService>;
  let coach: { open: jasmine.Spy; ask: jasmine.Spy; composerPrefill: ReturnType<typeof signal<string | null>> };

  beforeEach(() => {
    data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getRecipeSuggestions']);
    data.getRecipeSuggestions.and.returnValue(of(fixtureOf('FITS')));
    coach = { open: jasmine.createSpy('open'), ask: jasmine.createSpy('ask'), composerPrefill: signal<string | null>(null) };
    TestBed.configureTestingModule({
      providers: [
        { provide: CoachStore, useValue: coach },
        { provide: FitSyncDataService, useValue: data },
        { provide: RecipesService, useValue: recipesServiceStub() }
      ]
    });
  });

  function render(): ComponentFixture<CookTonightComponent> {
    const fixture = TestBed.createComponent(CookTonightComponent);
    fixture.detectChanges();
    return fixture;
  }

  const el = (fixture: ComponentFixture<CookTonightComponent>) => fixture.nativeElement as HTMLElement;
  const text = (fixture: ComponentFixture<CookTonightComponent>, selector: string) => (el(fixture).querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('asks for three suggestions and shows a skeleton while they come', () => {
    const pending = new Subject<RecipeSuggestions>();
    data.getRecipeSuggestions.and.returnValue(pending);
    const fixture = render();

    expect(data.getRecipeSuggestions).toHaveBeenCalledWith(3);
    expect(el(fixture).querySelector('[aria-busy=true]')).not.toBeNull();
    expect(el(fixture).querySelector('.card')).toBeNull();

    pending.next(fixtureOf('FITS'));
    fixture.detectChanges();
    expect(el(fixture).querySelector('[aria-busy=true]')).toBeNull();
    expect(el(fixture).querySelector('.card')).not.toBeNull();
  });

  it('shows the FITS card: eyebrow, headline, chips and one row per suggestion with figures and reason', () => {
    const fixture = render();

    expect(text(fixture, '.eyebrow')).toBe('Cook for tonight');
    expect(text(fixture, 'h2')).toBe('Room for a proper dinner tonight.');
    expect(Array.from(el(fixture).querySelectorAll('.chips li')).map((chip) => chip.textContent)).toEqual([
      '620 kcal left',
      'protein 41 g short',
      'Iron lowest this week',
      'you usually eat at 19:30'
    ]);
    const rows = Array.from(el(fixture).querySelectorAll('.row'));
    expect(rows.length).toBe(3);
    expect(rows[0].querySelector('strong')?.textContent).toBe('Chicken Quinoa Greek Salad');
    expect(rows[0].querySelector('.figures')?.textContent).toBe('548 kcal · 38 g protein');
    expect(rows[0].querySelector('.reason')?.textContent).toBe('Fits your 620 left and closes most of the protein gap');
    expect(rows[0].querySelector('app-recipe-cover')).not.toBeNull();
    expect(rows[1].querySelector('.cook')?.getAttribute('aria-label')).toBe('Cook Chickpea Fajitas');
    expect(el(fixture).querySelector('.ask')).not.toBeNull();
  });

  it('shows two rows when protein is the only gap', () => {
    data.getRecipeSuggestions.and.returnValue(of(fixtureOf('PROTEIN_ONLY')));
    const fixture = render();
    expect(text(fixture, 'h2')).toBe('Protein is the one thing short today.');
    expect(el(fixture).querySelectorAll('.row').length).toBe(2);
  });

  it('shows one row when nothing is logged and one when the day is past its target', () => {
    data.getRecipeSuggestions.and.returnValue(of(fixtureOf('NOTHING_LOGGED')));
    let fixture = render();
    expect(text(fixture, 'h2')).toBe('Nothing logged today yet.');
    expect(el(fixture).querySelectorAll('.row').length).toBe(1);
    expect(text(fixture, '.reason')).toBe('Your most cooked this month');

    data.getRecipeSuggestions.and.returnValue(of(fixtureOf('PAST_TARGET')));
    fixture = render();
    expect(text(fixture, 'h2')).toBe("You're past today's target, a light option if you still cook.");
    expect(text(fixture, '.reason')).toBe('310 kcal, mostly vegetables');
    expect(el(fixture).querySelector('.ask')).not.toBeNull();
  });

  it('folds to one row after dinner, without the Ask pill, and Tomorrow sends the question to the coach', () => {
    data.getRecipeSuggestions.and.returnValue(of(fixtureOf('DINNER_LOGGED')));
    const fixture = render();

    expect(el(fixture).querySelector('.card')).toBeNull();
    expect(el(fixture).querySelector('.ask')).toBeNull();
    expect(text(fixture, '.folded-line')).toBe('Dinner logged · 2,010 of 2,100 kcal');
    expect(text(fixture, '.tomorrow')).toBe('Tomorrow');

    (el(fixture).querySelector('.tomorrow') as HTMLButtonElement).click();
    expect(coach.open).toHaveBeenCalled();
    expect(coach.ask).toHaveBeenCalledWith(TOMORROW_QUESTION);
  });

  it('opens the dock with the card question in the composer from the Ask pill, and sends nothing', () => {
    const fixture = render();

    (el(fixture).querySelector('.ask') as HTMLButtonElement).click();

    expect(coach.open).toHaveBeenCalled();
    expect(coach.composerPrefill()).toBe(COOK_CARD_PREFILL);
    expect(coach.ask).not.toHaveBeenCalled();
  });

  it('opens the Ready sheet for the recipe of a row and closes it again', () => {
    const fixture = render();
    expect(el(fixture).querySelector('app-recipe-ready')).toBeNull();

    (el(fixture).querySelectorAll<HTMLButtonElement>('.row .cook')[1]).click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('app-recipe-ready')).not.toBeNull();
    expect(TestBed.inject(RecipesService).get).toHaveBeenCalledWith('s2');
  });

  it('shows one quiet line when the suggestions fail, with no retry panel and no rows', () => {
    data.getRecipeSuggestions.and.returnValue(throwError(() => new Error('down')));
    const fixture = render();

    expect(text(fixture, '.quiet')).toBe('Suggestions are not available right now.');
    expect(el(fixture).querySelector('.row')).toBeNull();
    expect(el(fixture).querySelector('.ask')).toBeNull();
  });
});
