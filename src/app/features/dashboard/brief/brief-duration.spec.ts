import { formatDuration } from './brief-duration';

describe('formatDuration', () => {
  it('renders zero minutes as "0 min"', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('renders sub-hour durations as minutes only', () => {
    expect(formatDuration(50)).toBe('50 min');
  });

  it('renders exactly one hour without a minutes component', () => {
    expect(formatDuration(60)).toBe('1 h');
  });

  it('renders an hour-plus duration with both components', () => {
    expect(formatDuration(170)).toBe('2 h 50 min');
  });

  it('renders a large duration correctly', () => {
    expect(formatDuration(1230)).toBe('20 h 30 min');
  });

  it('rounds fractional minutes to the nearest whole minute first', () => {
    expect(formatDuration(59.6)).toBe('1 h');
  });

  it('returns an empty string for null', () => {
    expect(formatDuration(null)).toBe('');
  });

  it('returns an empty string for undefined', () => {
    expect(formatDuration(undefined)).toBe('');
  });

  it('returns an empty string for NaN', () => {
    expect(formatDuration(NaN)).toBe('');
  });

  it('returns an empty string for a negative duration', () => {
    expect(formatDuration(-5)).toBe('');
  });
});
