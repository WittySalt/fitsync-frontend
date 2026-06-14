import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, Observable, switchMap, tap, throwError } from 'rxjs';

import { AUTH_STORAGE_KEYS, COGNITO_AUTH_CONFIG } from './auth.config';

interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = COGNITO_AUTH_CONFIG;

  readonly authError = signal<string | null>(null);

  isAuthenticated(): boolean {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
    const expiresAt = Number(localStorage.getItem(AUTH_STORAGE_KEYS.expiresAt) ?? 0);
    return Boolean(token && expiresAt > Date.now());
  }

  async startLogin(screenHint?: 'signup'): Promise<void> {
    this.authError.set(null);
    const verifier = this.randomString(64);
    const challenge = await this.pkceChallenge(verifier);
    const state = this.randomString(32);

    sessionStorage.setItem(AUTH_STORAGE_KEYS.pkceVerifier, verifier);
    sessionStorage.setItem(AUTH_STORAGE_KEYS.oauthState, state);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: this.config.scope,
      redirect_uri: this.config.redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state
    });

    if (screenHint) {
      params.set('screen_hint', screenHint);
    }

    window.location.assign(`${this.config.domain}/oauth2/authorize?${params.toString()}`);
  }

  completeCallback(code: string, returnedState: string): Observable<void> {
    const verifier = sessionStorage.getItem(AUTH_STORAGE_KEYS.pkceVerifier);
    const expectedState = sessionStorage.getItem(AUTH_STORAGE_KEYS.oauthState);

    if (!code || !returnedState || !verifier || returnedState !== expectedState) {
      return throwError(() => new Error('Invalid authentication callback. Please sign in again.'));
    }

    const body = new HttpParams()
      .set('grant_type', 'authorization_code')
      .set('client_id', this.config.clientId)
      .set('code', code)
      .set('redirect_uri', this.config.redirectUri)
      .set('code_verifier', verifier);

    return this.http
      .post<TokenResponse>(`${this.config.domain}/oauth2/token`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
      .pipe(
        tap((tokens) => this.storeTokens(tokens)),
        switchMap(() => this.http.post('/api/v1/auth/bootstrap', {})),
        tap(() => this.clearPkceState()),
        map(() => undefined),
        catchError((error: HttpErrorResponse | Error) => {
          this.clearSession();
          return throwError(() => new Error(this.authErrorMessage(error)));
        })
      );
  }

  logout(): void {
    this.clearSession();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      logout_uri: this.config.postLogoutRedirectUri
    });

    window.location.assign(`${this.config.domain}/logout?${params.toString()}`);
  }

  completeLogout(): void {
    this.clearSession();
  }

  private storeTokens(tokens: TokenResponse): void {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, tokens.access_token);
    if (tokens.id_token) {
      localStorage.setItem(AUTH_STORAGE_KEYS.idToken, tokens.id_token);
    }
    if (tokens.refresh_token) {
      localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, tokens.refresh_token);
    }
    localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(Date.now() + tokens.expires_in * 1000));
  }

  private clearSession(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.idToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.expiresAt);
    this.clearPkceState();
  }

  private clearPkceState(): void {
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.pkceVerifier);
    sessionStorage.removeItem(AUTH_STORAGE_KEYS.oauthState);
  }

  private randomString(length: number): string {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => ('0' + (byte % 36).toString(36)).slice(-1)).join('');
  }

  private async pkceChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return this.base64Url(new Uint8Array(digest));
  }

  private base64Url(bytes: Uint8Array): string {
    const text = String.fromCharCode(...bytes);
    return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private authErrorMessage(error: HttpErrorResponse | Error): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'Unable to reach Cognito or FitSync backend. Check network and local gateway.';
    }
    return error.message || 'Authentication failed. Please try again.';
  }
}
