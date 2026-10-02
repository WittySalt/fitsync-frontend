import { CookWakeLock } from './cook-wake-lock';

describe('CookWakeLock', () => {
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'wakeLock');
  let released: number;
  let requested: number;

  function install(): void {
    Object.defineProperty(Navigator.prototype, 'wakeLock', {
      configurable: true,
      get: () => ({
        request: () => {
          requested++;
          return Promise.resolve({ release: () => { released++; return Promise.resolve(); } });
        }
      })
    });
  }

  beforeEach(() => {
    released = 0;
    requested = 0;
  });

  afterEach(() => {
    if (original) {
      Object.defineProperty(Navigator.prototype, 'wakeLock', original);
    } else {
      delete (Navigator.prototype as unknown as Record<string, unknown>)['wakeLock'];
    }
  });

  it('is not supported when the browser has no Wake Lock API', () => {
    delete (Navigator.prototype as unknown as Record<string, unknown>)['wakeLock'];
    const lock = new CookWakeLock();
    expect(lock.supported()).toBeFalse();
    lock.hold();
    lock.release();
    expect(requested).toBe(0);
  });

  it('takes the lock on hold and gives it back on release', async () => {
    install();
    const lock = new CookWakeLock();
    expect(lock.supported()).toBeTrue();
    lock.hold();
    await Promise.resolve();
    await Promise.resolve();
    expect(requested).toBe(1);
    lock.release();
    expect(released).toBe(1);
  });

  it('takes it again when the tab becomes visible', async () => {
    install();
    const lock = new CookWakeLock();
    lock.hold();
    await Promise.resolve();
    await Promise.resolve();
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    await Promise.resolve();
    expect(requested).toBe(2);
    lock.release();
  });

  it('lets go of a lock that arrives after release', async () => {
    install();
    const lock = new CookWakeLock();
    lock.hold();
    lock.release();
    await Promise.resolve();
    await Promise.resolve();
    expect(released).toBe(1);
  });
});
