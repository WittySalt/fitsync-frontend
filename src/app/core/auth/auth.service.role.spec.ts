import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AUTH_STORAGE_KEYS } from './auth.config';
import { AuthService } from './auth.service';

function fakeJwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'none' })}.${encode(payload)}.signature`;
}

describe('AuthService role', () => {
  function createService(storedJwt: string | null): AuthService {
    localStorage.clear();
    if (storedJwt) {
      localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, storedJwt);
    }
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return TestBed.inject(AuthService);
  }

  afterEach(() => localStorage.clear());

  it('has no role when nobody is signed in', () => {
    const service = createService(null);

    expect(service.role()).toBeNull();
    expect(service.isAdmin()).toBeFalse();
  });

  it('falls back to the role claim of the stored application jwt', () => {
    const service = createService(fakeJwt({ role: 'ADMIN' }));

    expect(service.role()).toBe('ADMIN');
    expect(service.isAdmin()).toBeTrue();
  });

  it('reports a member for a member claim', () => {
    const service = createService(fakeJwt({ role: 'USER' }));

    expect(service.role()).toBe('USER');
    expect(service.isAdmin()).toBeFalse();
  });

  it('ignores a jwt without a role and a malformed jwt', () => {
    expect(createService(fakeJwt({ sub: 'u1' })).role()).toBeNull();
    expect(createService('not-a-jwt').role()).toBeNull();
    expect(createService('a.%%%.c').isAdmin()).toBeFalse();
  });

  it('prefers the role of the current-user response over the jwt claim', () => {
    const service = createService(fakeJwt({ role: 'ADMIN' }));

    service.setUserRole('USER');

    expect(service.role()).toBe('USER');
    expect(service.isAdmin()).toBeFalse();
  });

  it('keeps the jwt claim when the response has no role', () => {
    const service = createService(fakeJwt({ role: 'ADMIN' }));

    service.setUserRole(null);

    expect(service.isAdmin()).toBeTrue();
  });

  it('takes an administrator role from the response alone', () => {
    const service = createService(null);

    service.setUserRole('ADMIN');

    expect(service.isAdmin()).toBeTrue();
  });
});
