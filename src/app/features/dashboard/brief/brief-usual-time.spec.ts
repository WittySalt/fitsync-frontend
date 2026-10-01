import { clockMinutes, usualTimeSentence } from './brief-usual-time';

describe('clockMinutes', () => {
  it('reads a 24-hour HH:mm time', () => {
    expect(clockMinutes('00:00')).toBe(0);
    expect(clockMinutes('18:30')).toBe(18 * 60 + 30);
    expect(clockMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('refuses anything else', () => {
    for (const bad of ['24:00', '18:60', '6:30', '18:30:00', '18.30', '6:30 pm', '', ' 18:30', null, undefined]) {
      expect(clockMinutes(bad)).toBeNull();
    }
  });
});

describe('usualTimeSentence', () => {
  it('writes the time as it was sent', () => {
    expect(usualTimeSentence('MORNING', '06:45', 60)).toBe('You usually train around 06:45, so there is no rush.');
    expect(usualTimeSentence('AFTERNOON', '18:30', 14 * 60)).toBe('You usually train around 18:30, so there is no rush.');
  });

  it('needs at least an hour between now and the usual time', () => {
    expect(usualTimeSentence('AFTERNOON', '17:00', 16 * 60)).not.toBeNull();
    expect(usualTimeSentence('AFTERNOON', '17:00', 16 * 60 + 1)).toBeNull();
  });

  it('says nothing when the usual time has passed', () => {
    expect(usualTimeSentence('MORNING', '06:30', 8 * 60)).toBeNull();
  });

  it('says nothing in the evening or at night', () => {
    expect(usualTimeSentence('EVENING', '21:30', 17 * 60)).toBeNull();
    expect(usualTimeSentence('NIGHT', '23:30', 22 * 60)).toBeNull();
  });

  it('says nothing without a usable time or clock', () => {
    expect(usualTimeSentence('MORNING', null, 480)).toBeNull();
    expect(usualTimeSentence('MORNING', 'soon', 480)).toBeNull();
    expect(usualTimeSentence('MORNING', '18:30', null)).toBeNull();
  });
});
