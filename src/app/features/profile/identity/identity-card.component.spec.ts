import { memberLine } from './identity-card.component';

describe('memberLine', () => {
  it('shows the day the account was created in the profile zone, not the UTC day', () => {
    // 22:00 UTC on 10 Aug is 06:00 on 11 Aug in Singapore.
    expect(memberLine('2026-08-10T22:00:00Z', 'Singapore', 'Asia/Singapore')).toBe('Member since 11 Aug 2026 · Singapore');
    expect(memberLine('2026-08-10T22:00:00Z', null, 'America/Los_Angeles')).toBe('Member since 10 Aug 2026');
  });

  it('takes the year from the local day, so a New Year evening in UTC is the next year in Singapore', () => {
    expect(memberLine('2025-12-31T20:00:00Z', null, 'Asia/Singapore')).toBe('Member since 1 Jan 2026');
  });

  it('keeps a plain date as it is', () => {
    expect(memberLine('2026-08-10', 'Singapore', 'Asia/Singapore')).toBe('Member since 10 Aug 2026 · Singapore');
    expect(memberLine('2026-08-10', null, 'Pacific/Auckland')).toBe('Member since 10 Aug 2026');
  });

  it('leaves the date out when there is no date', () => {
    expect(memberLine('', 'Singapore', 'Asia/Singapore')).toBe('Singapore');
    expect(memberLine('not a date', null, 'Asia/Singapore')).toBe('');
  });
});
