import { signal } from '@angular/core';

interface WakeLockSentinelLike {
  release(): Promise<void>;
}

interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

/**
 * Keeps the screen awake while cook mode is open with the Screen Wake Lock API. The browser drops
 * the lock when the tab is hidden, so it is taken again when the tab comes back.
 */
export class CookWakeLock {
  /** False when the browser has no Wake Lock API; the page then hides "the screen stays on". */
  readonly supported = signal(CookWakeLock.isSupported());

  private sentinel: WakeLockSentinelLike | null = null;
  private wanted = false;
  private readonly onVisible = () => {
    if (this.wanted && document.visibilityState === 'visible') {
      // The browser let the old lock go when the tab was hidden.
      this.sentinel = null;
      void this.acquire();
    }
  };

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  hold(): void {
    this.wanted = true;
    document.addEventListener('visibilitychange', this.onVisible);
    void this.acquire();
  }

  release(): void {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisible);
    const held = this.sentinel;
    this.sentinel = null;
    if (held) {
      void held.release().catch(() => undefined);
    }
  }

  private async acquire(): Promise<void> {
    if (!this.supported() || this.sentinel) {
      return;
    }
    try {
      const api = (navigator as unknown as { wakeLock: WakeLockApi }).wakeLock;
      const held = await api.request('screen');
      if (this.wanted) {
        this.sentinel = held;
      } else {
        void held.release().catch(() => undefined);
      }
    } catch {
      // Refused (low battery, no permission): cooking goes on, the screen may dim.
    }
  }
}
