import { tabIndexForKey } from './today-tab';

describe('tab list keys', () => {
  it('moves with the arrows and wraps at both ends', () => {
    expect(tabIndexForKey('ArrowRight', 0, 3)).toBe(1);
    expect(tabIndexForKey('ArrowRight', 2, 3)).toBe(0);
    expect(tabIndexForKey('ArrowLeft', 0, 3)).toBe(2);
    expect(tabIndexForKey('ArrowLeft', 2, 3)).toBe(1);
  });

  it('goes to the ends with Home and End and ignores other keys', () => {
    expect(tabIndexForKey('Home', 2, 3)).toBe(0);
    expect(tabIndexForKey('End', 0, 3)).toBe(2);
    expect(tabIndexForKey('Enter', 0, 3)).toBeNull();
    expect(tabIndexForKey('a', 1, 3)).toBeNull();
  });
});
