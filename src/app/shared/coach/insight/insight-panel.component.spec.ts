import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { CoachApiService } from '../../../core/coach/coach-api.service';
import { CoachReading } from '../../../core/coach/coach.models';
import { CoachStore } from '../../../core/coach/coach.store';
import { INSIGHT_NOW, InsightPanelComponent, READING_POLL_LIMIT, READING_POLL_MS, ageLabel } from './insight-panel.component';
import { InsightReadState } from './insight-read-state';

const ready: CoachReading = {
  surface: 'WORKOUT',
  status: 'READY',
  readingId: '9f2c4e1ab03d77aa',
  period: 'PREVIOUS_WEEK',
  periodStart: '2026-09-21',
  periodEnd: '2026-09-27',
  facts: [
    { number: 1, key: 'VOLUME_PER_SESSION', label: 'Weight moved per session', value: '1,923', unit: 'kg', numericValue: 1923, note: 'Up 12%', detail: '1,716 kg the week before' },
    { number: 2, key: 'SESSION_LENGTH', label: 'Session length', value: '50', unit: 'min', numericValue: 50, note: 'Unchanged', detail: '50 min the week before' },
    { number: 3, key: 'RECORD', label: 'Dumbbell Bench Press record', value: '22.5', unit: 'kg', numericValue: 22.5, note: 'Monday', detail: '20 kg before' },
    { number: 4, key: 'MOST_TRAINED', label: 'Sessions with core work', value: '4', unit: 'of 4', numericValue: 4, note: 'Every one', detail: 'Plank Hold' }
  ],
  reading: {
    headline: 'Your lifts grew while your sessions stayed the same length.',
    body: 'You moved 1,923 kg a session [1], up from 1,716 kg, and each one still took 50 min [2].',
    citations: [1, 2],
    source: 'MODEL',
    generatedAt: '2026-09-28T15:20:00Z'
  },
  lifts: [{ exerciseName: 'Dumbbell Bench Press', fromKg: 20, fromDate: '2026-09-13', toKg: 22.5, toDate: '2026-09-25' }]
};

const resting: CoachReading = { ...ready, status: 'RESTING', reading: null };
const writing: CoachReading = { ...ready, status: 'WRITING', reading: null };
const empty: CoachReading = { ...ready, status: 'EMPTY', readingId: null, facts: [], reading: null, lifts: [] };

describe('InsightPanelComponent', () => {
  let fixture: ComponentFixture<InsightPanelComponent>;
  let element: HTMLElement;
  let api: jasmine.SpyObj<CoachApiService>;
  let store: { composerPrefill: ReturnType<typeof signal<string | null>>; open: jasmine.Spy };
  let readState: jasmine.SpyObj<InsightReadState>;

  function render(): void {
    fixture = TestBed.createComponent(InsightPanelComponent);
    fixture.componentRef.setInput('surface', 'WORKOUT');
    fixture.componentRef.setInput('timezone', 'Asia/Singapore');
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string {
    return element.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  beforeEach(async () => {
    api = jasmine.createSpyObj<CoachApiService>('CoachApiService', ['getReading']);
    api.getReading.and.returnValue(of(ready));
    store = { composerPrefill: signal<string | null>(null), open: jasmine.createSpy('open') };
    readState = jasmine.createSpyObj<InsightReadState>('InsightReadState', ['wasRead', 'markRead']);
    readState.wasRead.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [InsightPanelComponent],
      providers: [
        { provide: CoachApiService, useValue: api },
        { provide: CoachStore, useValue: store },
        { provide: InsightReadState, useValue: readState },
        { provide: INSIGHT_NOW, useValue: () => new Date('2026-09-28T15:22:00Z') }
      ]
    }).compileComponents();
  });

  it('asks for the reading of its page in the given timezone', () => {
    render();
    expect(api.getReading).toHaveBeenCalledOnceWith('WORKOUT', 'Asia/Singapore');
  });

  it('shows the reading with its headline, its body and when it was written', () => {
    render();
    expect(text('.reading-headline')).toBe('Your lifts grew while your sessions stayed the same length.');
    expect(text('.reading-body')).toContain('You moved 1,923 kg a session');
    expect(text('.written')).toBe('Coach model · 2 min ago');
  });

  it('says so when the reading was written by fixed rules, and leaves the time out', () => {
    api.getReading.and.returnValue(of({ ...ready, reading: { ...ready.reading!, source: 'RULES' } }));
    render();
    expect(text('.written')).toBe('Fixed rules');
    expect(text('.reading-headline')).toBe('Your lifts grew while your sessions stayed the same length.');
  });

  it('remembers a rule-written and a model-written reading of the same facts separately', () => {
    api.getReading.and.returnValue(of({ ...ready, reading: { ...ready.reading!, source: 'RULES' } }));
    render();
    expect(readState.wasRead).toHaveBeenCalledWith('WORKOUT', '9f2c4e1ab03d77aa:RULES');
    fixture.destroy();
    expect(readState.markRead).toHaveBeenCalledOnceWith('WORKOUT', '9f2c4e1ab03d77aa:RULES');
  });

  it('draws each citation as a numbered badge and leaves the brackets out', () => {
    render();
    const badges = Array.from(element.querySelectorAll('.citation')).map((node) => node.textContent?.trim());
    expect(badges).toEqual(['1', '2']);
    expect(text('.reading-body')).not.toContain('[');
  });

  it('lists the four facts with number, label, value, unit and note', () => {
    render();
    const column = (selector: string): string[] =>
      Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    expect(column('.fact .fact-number')).toEqual(['1', '2', '3', '4']);
    expect(column('.fact .fact-label')).toEqual(['Weight moved per session', 'Session length', 'Dumbbell Bench Press record', 'Sessions with core work']);
    expect(column('.fact .fact-value')).toEqual(['1,923 kg', '50 min', '22.5 kg', '4 of 4']);
    expect(column('.fact .fact-note')).toEqual(['Up 12%', 'Unchanged', 'Monday', 'Every one']);
  });

  it('draws the slope chart when there are lifts to compare', () => {
    render();
    expect(element.querySelector('app-slope-chart svg')).not.toBeNull();
  });

  it('fills the coach composer with the reading and opens the coach, without sending anything', () => {
    render();
    (element.querySelector('.reading-actions button') as HTMLButtonElement).click();
    expect(store.composerPrefill()).toBe('About this reading: "Your lifts grew while your sessions stayed the same length."');
    expect(store.open).toHaveBeenCalledTimes(1);
  });

  it('opens folded when the reading was read before, and unfolds on request', () => {
    readState.wasRead.and.returnValue(true);
    render();
    expect(element.querySelector('.folded')).not.toBeNull();
    expect(element.querySelector('.panel')).toBeNull();
    expect(text('.folded-headline')).toBe('Your lifts grew while your sessions stayed the same length.');

    (element.querySelector('.folded button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('.panel')).not.toBeNull();
  });

  it('remembers the reading as read when the user folds it', () => {
    render();
    (element.querySelector('.fold-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(readState.markRead).toHaveBeenCalledOnceWith('WORKOUT', '9f2c4e1ab03d77aa:MODEL');
    expect(element.querySelector('.folded')).not.toBeNull();
  });

  it('remembers the reading as read when the user leaves the page', () => {
    render();
    fixture.destroy();
    expect(readState.markRead).toHaveBeenCalledOnceWith('WORKOUT', '9f2c4e1ab03d77aa:MODEL');
  });

  it('does not mark a reading as read when it was only ever shown folded', () => {
    readState.wasRead.and.returnValue(true);
    render();
    fixture.destroy();
    expect(readState.markRead).not.toHaveBeenCalled();
  });

  it('keeps the facts and says the model is resting when there is no reading', () => {
    api.getReading.and.returnValue(of(resting));
    render();
    expect(text('.away-headline')).toBe('The coach model is resting.');
    expect(element.querySelectorAll('.fact').length).toBe(4);
    expect(element.querySelector('.reading')).toBeNull();
    fixture.destroy();
    expect(readState.markRead).not.toHaveBeenCalled();
  });

  it('takes no space when there is nothing to show', () => {
    api.getReading.and.returnValue(of(empty));
    render();
    expect(element.children.length).toBe(0);
  });

  it('takes no space when the request fails', () => {
    api.getReading.and.returnValue(throwError(() => new Error('offline')));
    render();
    expect(element.children.length).toBe(0);
  });

  it('shows a skeleton while the first request is on its way', () => {
    api.getReading.and.returnValue(new Subject<CoachReading>());
    render();
    expect(element.querySelector('.panel-skeleton')).not.toBeNull();
  });

  it('asks again while the reading is being written and shows it when it arrives', fakeAsync(() => {
    api.getReading.and.returnValues(of(writing), of(writing), of(ready));
    render();
    expect(text('.away-headline')).toBe('The reading is being written.');
    expect(element.querySelectorAll('.fact').length).toBe(4);

    tick(READING_POLL_MS);
    fixture.detectChanges();
    expect(text('.away-headline')).toBe('The reading is being written.');

    tick(READING_POLL_MS);
    fixture.detectChanges();
    expect(text('.reading-headline')).toBe('Your lifts grew while your sessions stayed the same length.');
    expect(api.getReading).toHaveBeenCalledTimes(3);
  }));

  it('stops asking after the last attempt and shows the model as resting', fakeAsync(() => {
    api.getReading.and.returnValue(of(writing));
    render();
    tick(READING_POLL_MS * (READING_POLL_LIMIT + 2));
    fixture.detectChanges();
    expect(api.getReading).toHaveBeenCalledTimes(READING_POLL_LIMIT);
    expect(text('.away-headline')).toBe('The coach model is resting.');
  }));

  it('stops asking when the user leaves the page', fakeAsync(() => {
    api.getReading.and.returnValue(of(writing));
    render();
    fixture.destroy();
    tick(READING_POLL_MS * 3);
    expect(api.getReading).toHaveBeenCalledTimes(1);
  }));

  it('shows the working on request, with the period and each fact in full', () => {
    render();
    const link = element.querySelector('.working-link') as HTMLButtonElement;
    expect(link.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('.working')).toBeNull();

    link.click();
    fixture.detectChanges();
    expect(link.getAttribute('aria-expanded')).toBe('true');
    expect(text('.working-link')).toBe('Hide the working');
    expect(text('.working-period')).toBe('Measured from 21 Sept to 27 Sept.');
    expect(text('.working-list li:first-child strong')).toBe('Weight moved per session');
    expect(text('.working-list li:first-child .working-text > span')).toBe('1,923 kg, 1,716 kg the week before');
  });
});

describe('ageLabel', () => {
  const now = new Date('2026-09-28T15:22:00Z');

  it('describes how long ago a reading was written', () => {
    expect(ageLabel('2026-09-28T15:21:40Z', now)).toBe('just now');
    expect(ageLabel('2026-09-28T15:20:00Z', now)).toBe('2 min ago');
    expect(ageLabel('2026-09-28T12:20:00Z', now)).toBe('3 h ago');
    expect(ageLabel('2026-09-27T12:20:00Z', now)).toBe('1 day ago');
    expect(ageLabel('2026-09-25T12:20:00Z', now)).toBe('3 days ago');
  });

  it('treats a time in the future as just now and an unreadable one as unknown', () => {
    expect(ageLabel('2026-09-28T16:00:00Z', now)).toBe('just now');
    expect(ageLabel('soon', now)).toBe('');
  });
});
