import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { AUTH_STORAGE_KEYS } from './auth.config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient()]
    });
    service = TestBed.inject(AuthService);
  });

  it('reports unauthenticated when no token exists', () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('reports authenticated for a non-expired access token', () => {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'token');
    localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(Date.now() + 60_000));

    expect(service.isAuthenticated()).toBeTrue();
  });

  it('rejects callback without state and verifier', (done) => {
    service.completeCallback('', '').subscribe({
      next: () => done.fail('Expected callback to fail'),
      error: (error: Error) => {
        expect(error.message).toContain('Invalid authentication callback');
        done();
      }
    });
  });
});
