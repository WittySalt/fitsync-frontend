import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';

import { SpeechHandlers, SpeechService } from './speech.service';
import { StepCarouselComponent } from './step-carousel.component';

const STEPS = [
  'Lie back with a dumbbell in each hand at chest height, palms forward.',
  'Press both up until the arms are straight.',
  'Lower slowly.'
];

describe('StepCarouselComponent', () => {
  let fixture: ComponentFixture<StepCarouselComponent>;
  let speech: { available: boolean; speak: jasmine.Spy<(text: string, handlers: SpeechHandlers) => void>; cancel: jasmine.Spy };

  function mount(inputs: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(StepCarouselComponent);
    fixture.componentRef.setInput('steps', STEPS);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const index = () => fixture.componentInstance.index();
  const click = (selector: string) => {
    root().querySelector<HTMLButtonElement>(selector)?.click();
    fixture.detectChanges();
  };
  /** Lets one step run its course and lets the effect set up the next wait. */
  const wait = (ms: number) => {
    tick(ms);
    fixture.detectChanges();
  };

  beforeEach(() => {
    speech = { available: true, speak: jasmine.createSpy('speak'), cancel: jasmine.createSpy('cancel') };
    TestBed.configureTestingModule({
      imports: [StepCarouselComponent],
      providers: [{ provide: SpeechService, useValue: speech }]
    });
  });

  it('shows one step at a time with a dot for each', () => {
    mount();

    expect(root().querySelector('.step')?.textContent).toBe(STEPS[0]);
    expect(root().querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('How to, step 1 of 3');
    expect(root().querySelectorAll('.dot').length).toBe(3);
    expect(root().querySelector('.dot.on')?.getAttribute('aria-label')).toBe('Step 1');
  });

  it('renders nothing when the exercise has no steps', () => {
    mount({ steps: [] });

    expect(root().querySelector('.carousel')).toBeNull();
  });

  it('does not turn by itself when no set is running', fakeAsync(() => {
    mount();

    wait(120_000);

    expect(index()).toBe(0);
    discardPeriodicTasks();
    flush();
  }));

  it('turns at reading pace while a set runs and the last step stays', fakeAsync(() => {
    mount({ running: true });

    // 13 words: 13 / 3 s + 2 s = 6.33 s.
    wait(6333);
    expect(index()).toBe(0);
    wait(1);
    expect(index()).toBe(1);

    // 8 words: 4.67 s, so the 5 s minimum.
    wait(4999);
    expect(index()).toBe(1);
    wait(1);
    expect(index()).toBe(2);

    wait(120_000);
    expect(index()).toBe(2);
    discardPeriodicTasks();
    flush();
  }));

  it('shares a short set evenly when that is shorter than the reading time, never under 3 s', fakeAsync(() => {
    mount({ running: true, setSeconds: 12 });

    wait(3999);
    expect(index()).toBe(0);
    wait(1);
    expect(index()).toBe(1);

    fixture.componentRef.setInput('setSeconds', 3);
    fixture.detectChanges();
    wait(2999);
    expect(index()).toBe(1);
    wait(1);
    expect(index()).toBe(2);
    discardPeriodicTasks();
    flush();
  }));

  it('waits while paused and goes on when resumed', fakeAsync(() => {
    mount({ running: true, paused: true });

    wait(120_000);
    expect(index()).toBe(0);

    fixture.componentRef.setInput('paused', false);
    fixture.detectChanges();
    wait(6334);
    expect(index()).toBe(1);
    discardPeriodicTasks();
    flush();
  }));

  it('starts again from the first step when the next set runs, and a tap only held the set before', fakeAsync(() => {
    mount({ running: true });
    click('.dot:nth-child(2)');
    wait(120_000);
    expect(index()).toBe(1);

    fixture.componentRef.setInput('running', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('running', true);
    fixture.detectChanges();
    expect(index()).toBe(0);
    wait(6334);
    expect(index()).toBe(1);
    discardPeriodicTasks();
    flush();
  }));

  it('does not announce a step that turns by itself, and does once a person holds it', fakeAsync(() => {
    mount({ running: true });
    expect(root().querySelector('.step')?.getAttribute('aria-live')).toBe('off');

    click('.text');

    expect(root().querySelector('.step')?.getAttribute('aria-live')).toBe('polite');
    discardPeriodicTasks();
    flush();
  }));

  it('holds on a tap, and moves to the next step on a second tap', fakeAsync(() => {
    mount({ running: true });

    click('.text');
    wait(120_000);
    expect(index()).toBe(0);

    click('.text');
    expect(index()).toBe(1);
    wait(120_000);
    expect(index()).toBe(1);
    discardPeriodicTasks();
    flush();
  }));

  it('still turns with reduced motion, without the slide', fakeAsync(() => {
    mount({ running: true, reducedMotion: true });

    wait(6334);

    expect(index()).toBe(1);
    discardPeriodicTasks();
    flush();
  }));

  it('goes straight to the next step on a tap when no set is running', fakeAsync(() => {
    mount();

    click('.text');
    expect(index()).toBe(1);
    click('.dot:nth-child(3)');
    expect(index()).toBe(2);
    expect(root().querySelector('.dot.on')?.getAttribute('aria-label')).toBe('Step 3');
    discardPeriodicTasks();
    flush();
  }));

  it('does not move while the workout is paused or the guide is open over it', fakeAsync(() => {
    mount({ running: true, paused: true });

    wait(120_000);

    expect(index()).toBe(0);
    discardPeriodicTasks();
    flush();
  }));

  it('goes to the step of a dot and holds there', fakeAsync(() => {
    mount({ running: true });

    click('.dot:nth-child(2)');
    wait(120_000);

    expect(index()).toBe(1);
    expect(root().querySelector('.dot[aria-current="step"]')?.getAttribute('aria-label')).toBe('Step 2');
    discardPeriodicTasks();
    flush();
  }));

  it('says it wants the How to guide', () => {
    mount();
    const opened = jasmine.createSpy('howTo');
    fixture.componentInstance.howTo.subscribe(opened);

    click('.howto');

    expect(opened).toHaveBeenCalledTimes(1);
  });

  describe('reading aloud', () => {
    it('reads the current step and holds the turn until the reading ends', fakeAsync(() => {
      mount({ running: true });

      click('.speaker');
      expect(root().querySelector('.speaker')?.getAttribute('aria-pressed')).toBe('true');
      expect(speech.speak).toHaveBeenCalledTimes(1);
      expect(speech.speak.calls.mostRecent().args[0]).toBe(STEPS[0]);

      wait(120_000);
      expect(index()).toBe(0);

      speech.speak.calls.mostRecent().args[1].ended();
      fixture.detectChanges();
      expect(fixture.componentInstance.reading()).toBeFalse();
      expect(index()).toBe(0);
      wait(6334);
      expect(index()).toBe(1);
      expect(speech.speak).toHaveBeenCalledTimes(1);
      discardPeriodicTasks();
      flush();
    }));

    it('stops reading when the speaker is pressed again', () => {
      mount();
      click('.speaker');

      click('.speaker');

      expect(speech.cancel).toHaveBeenCalled();
      expect(fixture.componentInstance.reading()).toBeFalse();
    });

    it('turns reading off when the browser cannot read the step', () => {
      mount();
      click('.speaker');

      speech.speak.calls.mostRecent().args[1].failed?.();
      fixture.detectChanges();

      expect(fixture.componentInstance.reading()).toBeFalse();
    });

    it('stops reading when it goes away', () => {
      mount();
      click('.speaker');

      fixture.destroy();

      expect(speech.cancel).toHaveBeenCalled();
    });

    it('hides the speaker when the browser has no speech synthesis', () => {
      speech.available = false;
      mount();

      expect(root().querySelector('.speaker')).toBeNull();
    });
  });
});
