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

  it('moves on at reading pace, goes round once and stays on the first step', fakeAsync(() => {
    mount();

    // 13 words: 2.5 s + 13 x 0.3 s.
    wait(6399);
    expect(index()).toBe(0);
    wait(1);
    expect(index()).toBe(1);

    // 8 words: 4.9 s.
    wait(4899);
    expect(index()).toBe(1);
    wait(1);
    expect(index()).toBe(2);

    // 2 words: the 4 s minimum.
    wait(3999);
    expect(index()).toBe(2);
    wait(1);
    expect(index()).toBe(0);

    wait(120_000);
    expect(index()).toBe(0);
    discardPeriodicTasks();
    flush();
  }));

  it('does not announce a step that turns by itself, and does once a person holds it', fakeAsync(() => {
    mount();
    expect(root().querySelector('.step')?.getAttribute('aria-live')).toBe('off');

    click('.text');

    expect(root().querySelector('.step')?.getAttribute('aria-live')).toBe('polite');
    discardPeriodicTasks();
    flush();
  }));

  it('holds on a tap, and moves to the next step on a second tap', fakeAsync(() => {
    mount();

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

  it('never moves by itself with reduced motion, and a tap goes straight to the next step', fakeAsync(() => {
    mount({ reducedMotion: true });

    wait(120_000);
    expect(index()).toBe(0);

    click('.text');
    expect(index()).toBe(1);
    click('.dot:nth-child(3)');
    expect(index()).toBe(2);
    expect(root().querySelector('.dot.on')?.getAttribute('aria-label')).toBe('Step 3');
    discardPeriodicTasks();
    flush();
  }));

  it('does not move while the workout is paused or the guide is open over it', fakeAsync(() => {
    mount({ paused: true });

    wait(120_000);

    expect(index()).toBe(0);
    discardPeriodicTasks();
    flush();
  }));

  it('goes to the step of a dot and holds there', fakeAsync(() => {
    mount();

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
    it('reads the current step, and the end of a step moves on instead of the timer', fakeAsync(() => {
      mount();

      click('.speaker');
      expect(root().querySelector('.speaker')?.getAttribute('aria-pressed')).toBe('true');
      expect(speech.speak).toHaveBeenCalledTimes(1);
      expect(speech.speak.calls.mostRecent().args[0]).toBe(STEPS[0]);

      wait(120_000);
      expect(index()).toBe(0);

      speech.speak.calls.mostRecent().args[1].ended();
      fixture.detectChanges();
      expect(index()).toBe(1);
      expect(speech.speak.calls.mostRecent().args[0]).toBe(STEPS[1]);
      expect(root().querySelector('.step')?.getAttribute('aria-live')).toBe('off');
      discardPeriodicTasks();
      flush();
    }));

    it('stops reading after the last step and settles on the first', fakeAsync(() => {
      mount({ index: 2 });

      click('.speaker');
      speech.speak.calls.mostRecent().args[1].ended();
      fixture.detectChanges();

      expect(index()).toBe(0);
      expect(fixture.componentInstance.reading()).toBeFalse();
      wait(120_000);
      expect(index()).toBe(0);
      discardPeriodicTasks();
      flush();
    }));

    it('does not move on at the end of a step that a tap holds', fakeAsync(() => {
      mount();
      click('.speaker');
      click('.text');

      speech.speak.calls.mostRecent().args[1].ended();
      fixture.detectChanges();

      expect(index()).toBe(0);
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
