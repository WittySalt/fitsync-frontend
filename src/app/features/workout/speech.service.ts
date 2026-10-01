import { Injectable } from '@angular/core';

export interface SpeechHandlers {
  /** The text was read to its end. */
  ended: () => void;
  /** The browser could not read it; a reading that was only cut off by a newer one does not call this. */
  failed?: () => void;
}

/**
 * The browser's own speech synthesis, in English, behind a small surface that a test can replace.
 * Only the newest reading reports back, so cancelling one to start another never moves anything on.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  readonly available =
    typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  private current: SpeechSynthesisUtterance | null = null;

  speak(text: string, handlers: SpeechHandlers): void {
    if (!this.available || !text.trim()) {
      return;
    }
    this.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith('en'));
    if (voice) {
      utterance.voice = voice;
    }
    utterance.onend = () => {
      if (this.current === utterance) {
        this.current = null;
        handlers.ended();
      }
    };
    utterance.onerror = () => {
      if (this.current === utterance) {
        this.current = null;
        handlers.failed?.();
      }
    };
    this.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (!this.available) {
      return;
    }
    this.current = null;
    window.speechSynthesis.cancel();
  }
}
