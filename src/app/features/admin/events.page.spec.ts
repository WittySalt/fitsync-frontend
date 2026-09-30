import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';

import { AdminApiService, OutboxPending, OutboxPublishResult, OutboxService } from './admin-api.service';
import { EventsPage, oldestLabel } from './events.page';

const idle: OutboxPending = { pending: 0, oldestCreatedAt: null };
const waiting: OutboxPending = { pending: 3, oldestCreatedAt: '2026-09-30T11:57:00Z' };

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

describe('EventsPage', () => {
  let fixture: ComponentFixture<EventsPage>;
  let api: jasmine.SpyObj<AdminApiService>;
  let element: HTMLElement;
  let answers: Record<OutboxService, Observable<OutboxPending>>;

  function create(): void {
    fixture = TestBed.createComponent(EventsPage);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }


  const rows = () => Array.from(element.querySelectorAll('tbody tr'));
  const row = (name: string) => {
    const found = rows().find((candidate) => text(candidate.querySelector('th')) === name);
    if (!found) {
      throw new Error(`No row named ${name}`);
    }
    return found as HTMLElement;
  };

  function click(scope: Element, label: string): void {
    const found = Array.from(scope.querySelectorAll('button')).find((candidate) => text(candidate) === label);
    if (!found) {
      throw new Error(`No button named ${label}`);
    }
    found.click();
    fixture.detectChanges();
  }

  const cells = (name: string) => Array.from(row(name).querySelectorAll('td')).map((cell) => text(cell));

  beforeEach(async () => {
    // Noon UTC is the same calendar day in every timezone from UTC-11 to UTC+11.
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-09-30T12:00:00Z'));
    answers = { auth: of(idle), users: of(idle), workouts: of(waiting), nutrition: of(idle) };
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', ['getOutboxPending', 'publishOutbox']);
    api.getOutboxPending.and.callFake((service) => answers[service]);
    await TestBed.configureTestingModule({
      imports: [EventsPage],
      providers: [{ provide: AdminApiService, useValue: api }]
    }).compileComponents();
  });

  afterEach(() => jasmine.clock().uninstall());

  it('shows loading bars in every row and a busy Refresh while the rows load', () => {
    answers = { auth: new Subject(), users: new Subject(), workouts: new Subject(), nutrition: new Subject() };
    create();

    expect(rows().length).toBe(4);
    expect(element.querySelectorAll('tbody .skeleton').length).toBe(8);
    const refresh = Array.from(element.querySelectorAll('button')).find((candidate) => text(candidate) === 'Refresh');
    expect(refresh?.disabled).toBeTrue();
    expect(refresh?.getAttribute('aria-busy')).toBe('true');
    expect(text(element.querySelector('h1'))).toBe('Events');
  });

  it('lists the four services in order with the waiting count and the age of the oldest event', () => {
    create();

    expect(text(element.querySelector('thead'))).toBe('Service Waiting Oldest Action');
    expect(rows().map((candidate) => text(candidate.querySelector('th')))).toEqual(['Accounts', 'Profiles and goals', 'Workouts', 'Nutrition']);
    expect(cells('Accounts').slice(0, 2)).toEqual(['0', 'None']);
    expect(cells('Workouts').slice(0, 2)).toEqual(['3', '3 min']);
  });

  it('gives the full local time of the oldest event in a title and none when nothing waits', () => {
    create();

    expect(row('Workouts').querySelector('td.oldest')?.getAttribute('title')).toMatch(/^30 Sep[a-z]* 2026, \d\d:\d\d:\d\d$/);
    expect(row('Accounts').querySelector('td.oldest')?.hasAttribute('title')).toBeFalse();
  });

  it('asks each service by its own name', () => {
    create();

    expect(api.getOutboxPending.calls.allArgs()).toEqual([['auth'], ['users'], ['workouts'], ['nutrition']]);
  });

  it('reloads all four rows with Refresh and keeps the numbers on screen meanwhile', () => {
    create();
    answers = { auth: new Subject(), users: new Subject(), workouts: new Subject(), nutrition: new Subject() };

    click(element, 'Refresh');

    expect(api.getOutboxPending).toHaveBeenCalledTimes(8);
    expect(cells('Workouts').slice(0, 2)).toEqual(['3', '3 min']);
    expect(element.querySelector('tbody .skeleton')).toBeNull();
  });

  it('marks only the failed row and leaves the others readable', () => {
    answers.nutrition = throwError(() => new HttpErrorResponse({ status: 500 }));
    create();

    expect(text(row('Nutrition').querySelector('td'))).toBe('Could not be read');
    expect(row('Nutrition').querySelector('.action button')?.textContent?.trim()).toBe('Try again');
    expect(cells('Workouts').slice(0, 2)).toEqual(['3', '3 min']);
    expect(cells('Accounts').slice(0, 2)).toEqual(['0', 'None']);
    expect(element.querySelector('[role="alert"]')).toBeNull();
  });

  it('retries only the failed row', () => {
    answers.nutrition = throwError(() => new HttpErrorResponse({ status: 500 }));
    create();
    answers.nutrition = of({ pending: 2, oldestCreatedAt: '2026-09-30T09:00:00Z' });
    api.getOutboxPending.calls.reset();

    click(row('Nutrition'), 'Try again');

    expect(api.getOutboxPending.calls.allArgs()).toEqual([['nutrition']]);
    expect(cells('Nutrition').slice(0, 2)).toEqual(['2', '3 h']);
  });

  it('replaces the table with the administrators note when a service refuses the caller', () => {
    answers = {
      auth: throwError(() => new HttpErrorResponse({ status: 403 })),
      users: throwError(() => new HttpErrorResponse({ status: 403 })),
      workouts: throwError(() => new HttpErrorResponse({ status: 403 })),
      nutrition: throwError(() => new HttpErrorResponse({ status: 403 }))
    };
    create();

    expect(text(element.querySelector('[role="alert"]'))).toBe('This page is for administrators.');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('button')).toBeNull();
  });

  it('asks before publishing and runs nothing on Cancel', () => {
    create();

    click(row('Workouts'), 'Publish');

    expect(text(row('Workouts').querySelector('.action'))).toContain('Confirm');
    expect(api.publishOutbox).not.toHaveBeenCalled();

    click(row('Workouts'), 'Cancel');

    expect(api.publishOutbox).not.toHaveBeenCalled();
  });

  it('publishes one service, stays busy meanwhile, reports the count and reloads only that row', () => {
    create();
    const request = new Subject<OutboxPublishResult>();
    api.publishOutbox.and.returnValue(request);
    answers.workouts = of(idle);
    api.getOutboxPending.calls.reset();

    click(row('Workouts'), 'Publish');
    click(row('Workouts'), 'Confirm');

    expect(api.publishOutbox).toHaveBeenCalledOnceWith('workouts');
    const busy = row('Workouts').querySelector<HTMLButtonElement>('.action button');
    expect(busy?.disabled).toBeTrue();
    expect(busy?.getAttribute('aria-busy')).toBe('true');
    // The other rows stay usable while this one runs.
    expect(row('Accounts').querySelector<HTMLButtonElement>('.action button')?.disabled).toBeFalse();

    request.next({ requestedBatchSize: 50, publishedCount: 3 });
    request.complete();
    fixture.detectChanges();

    expect(text(row('Workouts').querySelector('[role="status"]'))).toBe('Published 3.');
    expect(api.getOutboxPending.calls.allArgs()).toEqual([['workouts']]);
    expect(cells('Workouts')[0]).toBe('0');
    expect(cells('Workouts')[1]).toBe('None');
  });

  it('shows the failure of a publish in its own row only', () => {
    create();
    api.publishOutbox.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    click(row('Workouts'), 'Publish');
    click(row('Workouts'), 'Confirm');

    expect(text(row('Workouts').querySelector('[role="status"]'))).toBe('It did not run. Try again.');
    expect(text(row('Accounts').querySelector('[role="status"]'))).toBe('');
    expect(row('Workouts').querySelector<HTMLButtonElement>('.action button')?.disabled).toBeFalse();
  });

  it('cannot publish twice with a double click on Confirm', () => {
    create();
    api.publishOutbox.and.returnValue(new Subject<OutboxPublishResult>());

    click(row('Workouts'), 'Publish');
    const confirm = Array.from(row('Workouts').querySelectorAll('button')).find((candidate) => text(candidate) === 'Confirm');
    confirm?.click();
    confirm?.click();

    expect(api.publishOutbox).toHaveBeenCalledTimes(1);
  });

  describe('oldestLabel', () => {
    const now = new Date('2026-09-30T12:00:00Z');

    it('is None when nothing waits, even if an instant is given', () => {
      expect(oldestLabel({ pending: 0, oldestCreatedAt: '2026-09-30T11:00:00Z' }, now)).toBe('None');
      expect(oldestLabel({ pending: 2, oldestCreatedAt: null }, now)).toBe('None');
    });

    it('is the relative age otherwise, and None for an unreadable instant', () => {
      expect(oldestLabel({ pending: 2, oldestCreatedAt: '2026-09-26T12:00:00Z' }, now)).toBe('4 d');
      expect(oldestLabel({ pending: 2, oldestCreatedAt: 'later' }, now)).toBe('None');
    });
  });
});
