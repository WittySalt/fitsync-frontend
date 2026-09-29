import { Injectable } from '@angular/core';

import { ReadingSurface } from '../../../core/coach/coach.models';

const KEY_PREFIX = 'fitsync.coach.reading.read.';

/**
 * Remembers which reading the user has already read on this device.
 *
 * It is a convenience and nothing depends on it. Storage can be missing or blocked, so every call
 * is guarded, and without storage the panel simply opens every time.
 */
@Injectable({ providedIn: 'root' })
export class InsightReadState {
  wasRead(surface: ReadingSurface, readingId: string | null): boolean {
    if (!readingId) {
      return false;
    }
    try {
      return localStorage.getItem(KEY_PREFIX + surface) === readingId;
    } catch {
      return false;
    }
  }

  markRead(surface: ReadingSurface, readingId: string | null): void {
    if (!readingId) {
      return;
    }
    try {
      localStorage.setItem(KEY_PREFIX + surface, readingId);
    } catch {
      // Without storage the panel opens again on the next visit, which is an acceptable loss.
    }
  }
}
