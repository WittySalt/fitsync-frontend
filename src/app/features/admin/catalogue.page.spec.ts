import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { CatalogueImportResult, AdminApiService, ExerciseSummary } from './admin-api.service';
import { CataloguePage, importResultMessage } from './catalogue.page';

const summary: ExerciseSummary = {
  total: 875,
  byType: [
    { type: 'MOBILITY', count: 123 },
    { type: 'STRENGTH', count: 675 },
    { type: 'CARDIO', count: 16 },
    { type: 'SPORT', count: 61 }
  ]
};

const imported: CatalogueImportResult = { processed: 875, created: 0, updated: 12, rejected: 1, unmappedTermCount: 0 };

// Angular drops the whitespace between elements, so the pieces of text are joined with a space.
function text(target: Element | null | undefined): string {
  const pieces: string[] = [];
  const walker = document.createTreeWalker(target ?? document.createElement('div'), NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const piece = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (piece) {
      pieces.push(piece);
    }
  }
  return pieces.join(' ');
}

describe('CataloguePage', () => {
  let fixture: ComponentFixture<CataloguePage>;
  let api: jasmine.SpyObj<AdminApiService>;
  let element: HTMLElement;

  function create(response: Observable<ExerciseSummary>): void {
    api.getExerciseSummary.and.returnValue(response);
    fixture = TestBed.createComponent(CataloguePage);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }


  function button(label: string): HTMLButtonElement {
    const found = Array.from(element.querySelectorAll('button')).find((candidate) => text(candidate) === label);
    if (!found) {
      throw new Error(`No button named ${label}`);
    }
    return found;
  }

  function click(label: string): void {
    button(label).click();
    fixture.detectChanges();
  }

  const status = () => text(element.querySelector('[role="status"] .status'));
  const rowTexts = () => Array.from(element.querySelectorAll('tbody tr')).map((row) => text(row));

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', ['getExerciseSummary', 'importExerciseCatalogue']);
    await TestBed.configureTestingModule({
      imports: [CataloguePage],
      providers: [{ provide: AdminApiService, useValue: api }]
    }).compileComponents();
  });

  it('shows skeleton blocks while the summary loads', () => {
    create(new Subject<ExerciseSummary>());

    expect(element.querySelector('.skeleton-page')?.getAttribute('role')).toBe('status');
    expect(element.querySelectorAll('.skeleton').length).toBe(3);
    expect(element.querySelector('table')).toBeNull();
    expect(text(element.querySelector('h1'))).toBe('Catalogue');
  });

  it('shows the total in a tile', () => {
    create(of(summary));

    expect(text(element.querySelector('.tile'))).toBe('Exercises 875');
  });

  it('lists the types from the largest with title case, count and whole percent', () => {
    create(of(summary));

    expect(text(element.querySelector('thead'))).toBe('Type Exercises Share');
    expect(rowTexts()).toEqual(['Strength 675 77%', 'Mobility 123 14%', 'Sport 61 7%', 'Cardio 16 2%']);
  });

  it('draws each share bar in proportion to the largest count', () => {
    create(of(summary));

    const widths = Array.from(element.querySelectorAll<HTMLElement>('.share-fill')).map((fill) => Math.round(parseFloat(fill.style.width)));

    expect(widths).toEqual([100, 18, 9, 2]);
  });

  it('says the catalogue is empty and still offers the import', () => {
    create(of({ total: 0, byType: [] }));

    expect(text(element.querySelector('.tile'))).toBe('Exercises 0');
    expect(text(element.querySelector('.empty'))).toBe('The catalogue is empty.');
    expect(element.querySelector('table')).toBeNull();
    expect(button('Import')).toBeTruthy();
  });

  it('shows an error with a retry that loads again', () => {
    api.getExerciseSummary.and.returnValues(throwError(() => new HttpErrorResponse({ status: 500 })), of(summary));
    fixture = TestBed.createComponent(CataloguePage);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('The catalogue numbers could not be loaded.');

    click('Try again');

    expect(api.getExerciseSummary).toHaveBeenCalledTimes(2);
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(text(element.querySelector('.tile'))).toBe('Exercises 875');
  });

  it('tells a member that the page is for administrators, without a retry', () => {
    create(throwError(() => new HttpErrorResponse({ status: 403 })));

    expect(text(element.querySelector('[role="alert"]'))).toBe('This page is for administrators.');
    expect(element.querySelector('button')).toBeNull();
  });

  it('asks before importing and runs nothing on Cancel', () => {
    create(of(summary));

    click('Import');

    expect(text(element.querySelector('.action-row'))).toContain('Confirm');
    expect(api.importExerciseCatalogue).not.toHaveBeenCalled();

    click('Cancel');

    expect(api.importExerciseCatalogue).not.toHaveBeenCalled();
    expect(button('Import')).toBeTruthy();
  });

  it('imports once after Confirm, stays busy meanwhile, reports the result and reloads the summary', () => {
    create(of(summary));
    const request = new Subject<CatalogueImportResult>();
    api.importExerciseCatalogue.and.returnValue(request);
    api.getExerciseSummary.and.returnValue(of({ total: 876, byType: [{ type: 'STRENGTH', count: 876 }] }));

    click('Import');
    click('Confirm');

    expect(api.importExerciseCatalogue).toHaveBeenCalledTimes(1);
    expect(button('Import').disabled).toBeTrue();
    expect(button('Import').getAttribute('aria-busy')).toBe('true');
    expect(api.getExerciseSummary).toHaveBeenCalledTimes(1);

    request.next(imported);
    request.complete();
    fixture.detectChanges();

    expect(status()).toBe('Processed 875. Created 0, updated 12, rejected 1.');
    expect(button('Import').disabled).toBeFalse();
    expect(api.getExerciseSummary).toHaveBeenCalledTimes(2);
    expect(text(element.querySelector('.tile'))).toBe('Exercises 876');
    expect(rowTexts()).toEqual(['Strength 876 100%']);
  });

  it('keeps the shown numbers and the import panel while the summary reloads after an import', () => {
    create(of(summary));
    const reload = new Subject<ExerciseSummary>();
    api.importExerciseCatalogue.and.returnValue(of(imported));
    api.getExerciseSummary.and.returnValue(reload);

    click('Import');
    click('Confirm');

    expect(element.querySelector('.skeleton')).toBeNull();
    expect(text(element.querySelector('.tile'))).toBe('Exercises 875');
    expect(status()).toContain('Processed 875.');
  });

  it('mentions the terms that could not be mapped', () => {
    create(of(summary));
    api.importExerciseCatalogue.and.returnValue(of({ ...imported, unmappedTermCount: 3 }));

    click('Import');
    click('Confirm');

    expect(status()).toBe('Processed 875. Created 0, updated 12, rejected 1. 3 terms could not be mapped.');
  });

  it('shows the failure of an import next to the button and does not reload', () => {
    create(of(summary));
    api.importExerciseCatalogue.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    click('Import');
    click('Confirm');

    expect(status()).toBe('It did not run. Try again.');
    expect(button('Import').disabled).toBeFalse();
    expect(api.getExerciseSummary).toHaveBeenCalledTimes(1);
  });

  it('cannot send the import twice with a double click on Confirm', () => {
    create(of(summary));
    api.importExerciseCatalogue.and.returnValue(new Subject<CatalogueImportResult>());

    click('Import');
    const confirm = button('Confirm');
    confirm.click();
    confirm.click();

    expect(api.importExerciseCatalogue).toHaveBeenCalledTimes(1);
  });

  describe('importResultMessage', () => {
    it('writes one term in the singular', () => {
      expect(importResultMessage({ ...imported, unmappedTermCount: 1 })).toBe('Processed 875. Created 0, updated 12, rejected 1. 1 term could not be mapped.');
    });

    it('leaves the last sentence out when every term was mapped', () => {
      expect(importResultMessage(imported)).toBe('Processed 875. Created 0, updated 12, rejected 1.');
    });
  });
});
