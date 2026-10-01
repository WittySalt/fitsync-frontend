import { TestBed } from '@angular/core/testing';

import { SpeechService } from './speech.service';

describe('SpeechService', () => {
  let service: SpeechService;
  let spoken: SpeechSynthesisUtterance[];
  let cancelCalls: number;
  const originalSynthesis = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
  const originalUtterance = (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;

  beforeEach(() => {
    spoken = [];
    cancelCalls = 0;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speak: (utterance: SpeechSynthesisUtterance) => spoken.push(utterance),
        cancel: () => (cancelCalls += 1),
        getVoices: () => [{ lang: 'fr-FR' }, { lang: 'en-GB' }]
      }
    });
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      lang = '';
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    };
    service = TestBed.inject(SpeechService);
  });

  afterEach(() => {
    if (originalSynthesis) {
      Object.defineProperty(window, 'speechSynthesis', originalSynthesis);
    } else {
      // The real one lives on the window's prototype; dropping the stub brings it back.
      delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
    }
    (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = originalUtterance;
  });

  const end = (utterance: SpeechSynthesisUtterance) => (utterance.onend as unknown as () => void)();
  const fail = (utterance: SpeechSynthesisUtterance) => (utterance.onerror as unknown as () => void)();

  it('is available when the browser has speech synthesis', () => {
    expect(service.available).toBeTrue();
  });

  it('reads the text in English with an English voice and reports its end', () => {
    const ended = jasmine.createSpy('ended');

    service.speak('Press up.', { ended });

    expect(spoken.length).toBe(1);
    expect(spoken[0].lang).toBe('en-US');
    expect((spoken[0].voice as unknown as { lang: string }).lang).toBe('en-GB');
    end(spoken[0]);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('does not report the end of a reading that a newer one replaced', () => {
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');

    service.speak('One.', { ended: first });
    service.speak('Two.', { ended: second });
    end(spoken[0]);
    end(spoken[1]);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('reports a failure of the newest reading only', () => {
    const failed = jasmine.createSpy('failed');

    service.speak('One.', { ended: () => undefined, failed });
    fail(spoken[0]);

    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('stops reading on cancel', () => {
    const ended = jasmine.createSpy('ended');
    service.speak('One.', { ended });
    const before = cancelCalls;

    service.cancel();
    end(spoken[0]);

    expect(cancelCalls).toBe(before + 1);
    expect(ended).not.toHaveBeenCalled();
  });
});
