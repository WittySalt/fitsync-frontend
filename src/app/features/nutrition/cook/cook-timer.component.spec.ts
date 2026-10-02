import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { CELEBRATE_LOCK_MS, CookTimerComponent } from './cook-timer.component';
import { CookTimerDef } from './cook.models';
import { TimerState, addMinute, createTimer, pauseTimer, startStage, tickTimer } from './cook-timer';

const sides: CookTimerDef = { seconds: 180, maxSeconds: 240, eachSide: true, phrase: '3-4 mins' };
const single: CookTimerDef = { seconds: 600, maxSeconds: null, eachSide: false, phrase: '10 minutes' };
const T0 = Date.now();

describe('CookTimerComponent', () => {
  let fixture: ComponentFixture<CookTimerComponent>;

  function show(state: TimerState, now = T0, extra: Record<string, unknown> = {}): HTMLElement {
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('now', now);
    Object.entries(extra).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function slot(el: HTMLElement): HTMLButtonElement {
    return el.querySelector('.slot') as HTMLButtonElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CookTimerComponent] });
    fixture = TestBed.createComponent(CookTimerComponent);
  });

  it('before the start shows the line, the stepper, the range note and the start button', () => {
    const el = show(createTimer(sides));
    expect(el.querySelector('.intro')?.textContent).toContain('First side, then the second · 3 min each');
    expect(el.querySelector('.note')?.textContent).toContain('The recipe says 3 to 4 min');
    expect((el.querySelector('.intro') as HTMLButtonElement).getAttribute('aria-label')).toBe('Change the time');
    expect(Array.from(el.querySelectorAll('.round')).every((button) => button.querySelector('svg') !== null && !button.textContent?.trim())).toBeTrue();
  });

  it('shows the name of a found timer above its time, in every phase', () => {
    const named = createTimer({ ...single, label: 'Brown patties' });
    expect(show(named).querySelector('.name')?.textContent).toBe('Brown patties');
    expect(show(startStage(named, T0)).querySelector('.name')?.textContent).toBe('Brown patties');
    expect(show(tickTimer(startStage(named, T0), T0 + 600_000).state, T0 + 600_000).querySelector('.name')?.textContent).toBe('Brown patties');
    expect(show(createTimer(single)).querySelector('.name')).toBeNull();
  });

  it('shows only the length for one stage and "Start timer"', () => {
    const el = show(createTimer(single));
    expect(el.querySelector('.intro')?.textContent?.trim()).toBe('10 min');
    expect(el.querySelector('.note')).toBeNull();
    expect(slot(el).textContent).toContain('Start timer');
    expect(el.querySelectorAll('.seg').length).toBe(1);
  });

  it('opens the shared time control from the length, and reports the time chosen in seconds, with Reset to the recipe time', () => {
    const retimed: number[] = [];
    fixture.componentInstance.retimed.subscribe((seconds) => retimed.push(seconds));
    const el = show(createTimer(single));
    (el.querySelector('.intro') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-cook-duration')).not.toBeNull();
    expect(el.querySelector('.round')).toBeNull();
    (el.querySelector('app-cook-duration .chips button:nth-child(4)') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.reset')).not.toBeNull();
    (el.querySelector('.set') as HTMLButtonElement).click();
    expect(retimed).toEqual([4200]);
  });

  it('emits the start', () => {
    let started = 0;
    fixture.componentInstance.started.subscribe(() => started++);
    slot(show(createTimer(sides))).click();
    expect(started).toBe(1);
  });

  it('while running shows the time, +1 min, two segments and an outlined Pause', () => {
    const state = startStage(createTimer(sides), T0);
    const el = show(state, T0 + 81_000);
    expect(el.querySelector('.time')?.textContent).toBe('1:39');
    expect(el.querySelector('.link')?.textContent).toContain('+1 min');
    expect(el.querySelectorAll('.seg').length).toBe(2);
    expect(slot(el).classList).toContain('outline');
    expect(slot(el).textContent).toContain('Pause');
  });

  it('shows Resume while paused', () => {
    const el = show(pauseTimer(startStage(createTimer(single), T0), T0 + 1000), T0 + 1000);
    expect(slot(el).textContent).toContain('Resume');
  });

  it('emits pause, resume and the extra minute', () => {
    const events: string[] = [];
    fixture.componentInstance.paused.subscribe(() => events.push('pause'));
    fixture.componentInstance.resumed.subscribe(() => events.push('resume'));
    fixture.componentInstance.minuteAdded.subscribe(() => events.push('minute'));
    const running = startStage(createTimer(single), T0);
    let el = show(running);
    slot(el).click();
    (el.querySelector('.link') as HTMLButtonElement).click();
    el = show(pauseTimer(running, T0 + 1000));
    slot(el).click();
    expect(events).toEqual(['pause', 'minute', 'resume']);
  });

  it('at the turn names the subject, ticks the first segment and offers the second side', () => {
    const turn = tickTimer(startStage(createTimer(sides), T0), T0 + 180_000).state;
    const el = show(turn, T0 + 190_000, { subject: 'salmon' });
    expect(el.querySelector('.heading')?.textContent).toBe('Turn the salmon');
    expect(slot(el).textContent).toContain('Start the second side');
    expect(el.textContent).toContain('First side done');
    expect(el.textContent).toContain('Second side, 3 min');
  });

  it('says "Turn it" when the subject is unknown', () => {
    const turn = tickTimer(startStage(createTimer(sides), T0), T0 + 180_000).state;
    expect(show(turn).querySelector('.heading')?.textContent).toBe('Turn it');
  });

  it('when done says both sides done, or just done, with Next step', () => {
    const second = startStage(tickTimer(startStage(createTimer(sides), T0), T0 + 180_000).state, T0 + 200_000);
    const done = tickTimer(second, T0 + 380_000).state;
    let el = show(done);
    expect(el.querySelector('.heading')?.textContent).toBe('Both sides done');
    expect(slot(el).textContent).toContain('Next step');
    el = show(tickTimer(startStage(createTimer(single), T0), T0 + 600_000).state);
    expect(el.querySelector('.heading')?.textContent).toBe('Done');
  });

  it('offers to finish on the last step', () => {
    const done = tickTimer(startStage(createTimer(single), T0), T0 + 600_000).state;
    expect(show(done, T0, { lastStep: true }).querySelector('.slot')?.textContent).toContain('Finish cooking');
  });

  it('keeps the button slot in every phase', () => {
    const idle = createTimer(single);
    const running = startStage(idle, T0);
    const done = tickTimer(running, T0 + 600_000).state;
    [idle, running, pauseTimer(running, T0), done].forEach((state) => {
      expect(show(state).querySelectorAll('.slot').length).toBe(1);
    });
  });

  it('plays the completion animation when a stage ends here, and unlocks the button after 1.2 s', fakeAsync(() => {
    const running = startStage(createTimer(sides), T0);
    show(running, T0 + 1000);
    const turn = tickTimer(running, T0 + 180_000).state;
    const el = show(turn, T0 + 180_000);
    expect(el.querySelector('.tick.pop')).not.toBeNull();
    expect(el.querySelector('.fading')).not.toBeNull();
    expect(slot(el).classList).toContain('locked');
    let started = 0;
    fixture.componentInstance.started.subscribe(() => started++);
    slot(el).click();
    expect(started).toBe(0);
    tick(CELEBRATE_LOCK_MS);
    fixture.detectChanges();
    expect(slot(el).classList).not.toContain('locked');
    expect(slot(el).classList).toContain('ready');
    slot(el).click();
    expect(started).toBe(1);
  }));

  it('does not play it for a timer that had already ended, or when the step changes', fakeAsync(() => {
    const done = tickTimer(startStage(createTimer(single), T0), T0 + 600_000).state;
    const el = show(done, T0, { stepKey: 3 });
    expect(el.querySelector('.tick.pop')).toBeNull();
    expect(slot(el).classList).not.toContain('locked');
    const running = startStage(createTimer(single), T0);
    show(running, T0, { stepKey: 4 });
    const other = show(tickTimer(running, T0 + 600_000).state, T0, { stepKey: 5 });
    expect(other.querySelector('.tick.pop')).toBeNull();
  }));

  it('adds a minute to the bar without a change in height of the button slot', () => {
    const el = show(addMinute(startStage(createTimer(single), T0)), T0);
    expect(el.querySelector('.time')?.textContent).toBe('11:00');
  });
});
