import { cookedWhen } from './leftovers-sheet.component';

describe('leftovers cookedWhen', () => {
  // 11:30 UTC on 1 October is 00:30 on Friday the 2nd in Auckland and 04:30 on Thursday the 1st in Los Angeles.
  const cookedAt = '2026-10-01T11:30:00Z';

  it('reads the day of the cook in the profile zone, not as its UTC date', () => {
    expect(cookedWhen(cookedAt, '2026-10-02', 'Pacific/Auckland')).toBe('Cooked today');
    expect(cookedWhen(cookedAt, '2026-10-02', 'America/Los_Angeles')).toBe('Cooked yesterday');
    expect(cookedWhen(cookedAt, '2026-10-04', 'Pacific/Auckland')).toBe('Cooked Friday');
    expect(cookedWhen(cookedAt, '2026-10-04', 'America/Los_Angeles')).toBe('Cooked Thursday');
  });

  it('says recently for a cook without a readable time', () => {
    expect(cookedWhen('not a date', '2026-10-02', 'Pacific/Auckland')).toBe('Cooked recently');
  });
});
