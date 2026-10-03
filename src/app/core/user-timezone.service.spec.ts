import { TestBed } from '@angular/core/testing';

import { UserTimezoneService } from './user-timezone.service';

describe('UserTimezoneService', () => {
  let service: UserTimezoneService;

  beforeEach(() => {
    service = TestBed.inject(UserTimezoneService);
  });

  it('uses the browser zone until a profile zone is known', () => {
    expect(service.zone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('switches to the profile zone and back when it is cleared', () => {
    service.setProfileZone('Asia/Tokyo');
    expect(service.zone()).toBe('Asia/Tokyo');
    service.setProfileZone(null);
    expect(service.zone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('reads the calendar day in the zone', () => {
    service.setProfileZone('Pacific/Kiritimati');
    expect(service.dateKey(new Date('2026-10-03T12:00:00Z'))).toBe('2026-10-04');
    service.setProfileZone('Pacific/Pago_Pago');
    expect(service.dateKey(new Date('2026-10-03T12:00:00Z'))).toBe('2026-10-03');
  });
});
