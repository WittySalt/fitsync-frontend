import { dismissAutoClosed, isAutoClosedDismissed } from './auto-closed-dismissal';

const KEY = 'fs-auto-closed-dismissed';

describe('auto-closed dismissal', () => {
  beforeEach(() => localStorage.removeItem(KEY));
  afterEach(() => localStorage.removeItem(KEY));

  it('remembers a dismissal by session id', () => {
    expect(isAutoClosedDismissed('session-1')).toBeFalse();

    dismissAutoClosed('session-1');

    expect(isAutoClosedDismissed('session-1')).toBeTrue();
    expect(isAutoClosedDismissed('session-2')).toBeFalse();
  });

  it('keeps only the latest few', () => {
    for (let index = 0; index < 25; index++) {
      dismissAutoClosed(`session-${index}`);
    }

    expect(isAutoClosedDismissed('session-24')).toBeTrue();
    expect(isAutoClosedDismissed('session-0')).toBeFalse();
  });

  it('shrugs off a damaged store', () => {
    localStorage.setItem(KEY, '{not json');
    expect(isAutoClosedDismissed('session-1')).toBeFalse();

    localStorage.setItem(KEY, '"a string"');
    expect(isAutoClosedDismissed('session-1')).toBeFalse();
  });

  it('shrugs off a store that refuses to answer', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');

    expect(isAutoClosedDismissed('session-1')).toBeFalse();
    expect(() => dismissAutoClosed('session-1')).not.toThrow();
  });
});
