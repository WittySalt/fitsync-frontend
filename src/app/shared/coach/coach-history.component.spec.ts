import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoachThreadSummary } from '../../core/coach/coach.models';
import { CoachStore, HistoryStatus } from '../../core/coach/coach.store';
import { CoachHistoryComponent } from './coach-history.component';

const now = new Date();
const iso = (daysAgo: number, hour = 12): string => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 10).toISOString();
const row = (id: string, title: string | null, surface: CoachThreadSummary['surface'], daysAgo: number): CoachThreadSummary => ({
  threadId: id,
  title,
  surface,
  lastMessageAt: iso(daysAgo),
  turnCount: 2
});

class FakeStore {
  history = signal<CoachThreadSummary[]>([]);
  historyStatus = signal<HistoryStatus>('ready');
  historyHasMore = signal(false);
  historyLoadingMore = signal(false);
  historyNotice = signal<string | null>(null);
  current: string | null = null;
  currentThreadId = (): string | null => this.current;
  openHistory = jasmine.createSpy('openHistory');
  closeHistory = jasmine.createSpy('closeHistory');
  loadMoreHistory = jasmine.createSpy('loadMoreHistory');
  openThread = jasmine.createSpy('openThread');
  archiveThread = jasmine.createSpy('archiveThread');
}

describe('CoachHistoryComponent', () => {
  let fixture: ComponentFixture<CoachHistoryComponent>;
  let element: HTMLElement;
  let store: FakeStore;

  function render(): void {
    fixture = TestBed.createComponent(CoachHistoryComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }
  const click = (selector: string, index = 0): void => {
    (element.querySelectorAll(selector)[index] as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    store = new FakeStore();
    await TestBed.configureTestingModule({ imports: [CoachHistoryComponent], providers: [{ provide: CoachStore, useValue: store }] }).compileComponents();
  });

  it('shows a skeleton while loading, with no rows', () => {
    store.historyStatus.set('loading');
    render();

    expect(element.querySelector('.skeleton')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('li')).toBeNull();
  });

  it('shows the error with a retry that asks the store to load again', () => {
    store.historyStatus.set('error');
    render();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    click('[role="alert"] button');
    expect(store.openHistory).toHaveBeenCalled();
  });

  it('shows the empty state', () => {
    render();
    expect(element.querySelector('.state')?.textContent?.trim()).toBe('No earlier conversations yet.');
  });

  it('groups rows under Today, This week and Earlier, with title, surface label and time', () => {
    const monday = (now.getDay() + 6) % 7; // days since Monday
    store.history.set([
      row('a', 'Chest day', 'WORKOUT', 0),
      ...(monday >= 2 ? [row('b', 'Protein', 'NUTRITION', 2)] : []),
      row('c', null, null, 40)
    ]);
    render();

    const headings = Array.from(element.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(headings).toEqual(monday >= 2 ? ['Today', 'This week', 'Earlier'] : ['Today', 'Earlier']);
    const first = element.querySelector('li');
    expect(first?.querySelector('.title')?.textContent?.trim()).toBe('Chest day');
    expect(first?.querySelector('.chip')?.textContent?.trim()).toBe('Workout');
    expect(first?.querySelector('.meta')?.textContent).toContain('Today 12:10');
    const last = Array.from(element.querySelectorAll('li')).pop();
    expect(last?.querySelector('.title')?.textContent?.trim()).toBe('Untitled conversation');
    expect(last?.querySelector('.chip')).toBeNull();
  });

  it('opens a row, highlights the current one and goes back', () => {
    store.current = 'b';
    store.history.set([row('a', 'One', 'HOME', 0), row('b', 'Two', 'HOME', 0)]);
    render();

    expect(element.querySelectorAll('li.current').length).toBe(1);
    expect(element.querySelectorAll('li')[1].classList.contains('current')).toBeTrue();
    click('.open');
    expect(store.openThread).toHaveBeenCalledWith('a');
    click('.back');
    expect(store.closeHistory).toHaveBeenCalled();
  });

  it('pages with Show more, and says Loading while it fetches', () => {
    store.history.set([row('a', 'One', 'HOME', 0)]);
    store.historyHasMore.set(true);
    render();

    click('.wide');
    expect(store.loadMoreHistory).toHaveBeenCalled();

    store.historyLoadingMore.set(true);
    fixture.detectChanges();
    const button = element.querySelector('.wide') as HTMLButtonElement;
    expect(button.disabled).toBeTrue();
    expect(button.textContent?.trim()).toBe('Loading…');
  });

  it('archives only after a confirm, and red appears on the confirm button alone', () => {
    store.history.set([row('a', 'One', 'HOME', 0)]);
    render();

    click('.more');
    expect(element.querySelector('.confirm')).toBeNull();
    click('.menu .quiet');
    expect(store.archiveThread).not.toHaveBeenCalled();
    expect(element.querySelectorAll('.confirm').length).toBe(1);

    click('.confirm');
    expect(store.archiveThread).toHaveBeenCalledWith('a');
    expect(element.querySelector('.menu')).toBeNull();
  });

  it('lets the user back out of the confirm', () => {
    store.history.set([row('a', 'One', 'HOME', 0)]);
    render();

    click('.more');
    click('.menu .quiet');
    click('.menu .quiet:last-child');

    expect(store.archiveThread).not.toHaveBeenCalled();
    expect(element.querySelector('.menu')).toBeNull();
  });

  it('shows a notice from a failed open or archive', () => {
    store.historyNotice.set('That conversation could not be opened. Try again in a moment.');
    render();
    expect(element.querySelector('.note')?.textContent).toContain('could not be opened');
  });
});
