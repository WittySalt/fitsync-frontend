import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, map, Observable, of, switchMap, tap, throwError } from 'rxjs';

import { AUTH_STORAGE_KEYS, COGNITO_AUTH_CONFIG } from './auth.config';

interface CognitoAttribute {
  Name: string;
  Value: string;
}

interface CognitoTokenSet {
  AccessToken: string;
  IdToken?: string;
  RefreshToken?: string;
  ExpiresIn: number;
}

interface InitiateAuthResponse {
  AuthenticationResult?: CognitoTokenSet;
  ChallengeName?: string;
}

interface BootstrapAuthResponse {
  accessToken: string;
  tokenType: string;
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

  ensureSession(): Observable<boolean> {
    if (this.isAuthenticated()) {
      return of(true);
    }

    const cognitoIdToken = localStorage.getItem(AUTH_STORAGE_KEYS.cognitoIdToken);
    if (!cognitoIdToken) {
      this.clearLocalAccessToken();
      return of(false);
    }

    return this.bootstrapWithCognitoToken(cognitoIdToken).pipe(
      map(() => true),
      catchError(() => {
        this.clearSession();
        return of(false);
      })
    );
  }

  signIn(email: string, password: string): Observable<void> {
    this.authError.set(null);
    this.clearSession();

    return this.cognitoPost<InitiateAuthResponse>('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.config.clientId,
      AuthParameters: {
        USERNAME: email.trim(),
        PASSWORD: password
      }
    }).pipe(
      switchMap((response) => {
        if (response.ChallengeName) {
          return throwError(() => new Error(`Cognito challenge is not implemented yet: ${response.ChallengeName}`));
        }

        const tokens = response.AuthenticationResult;
        if (!tokens?.AccessToken || !tokens.IdToken) {
          return throwError(() => new Error('Cognito did not return the required tokens.'));
        }

        this.storeCognitoTokens(tokens);
        return this.bootstrapWithCognitoToken(tokens.IdToken);
      }),
      catchError((error: HttpErrorResponse | Error) => {
        this.clearSession();
        return throwError(() => new Error(this.authErrorMessage(error)));
      })
    );
  }

  signUp(email: string, password: string, displayName: string): Observable<void> {
    const userAttributes: CognitoAttribute[] = [{ Name: 'email', Value: email.trim() }];
    const normalizedDisplayName = displayName.trim();
    if (normalizedDisplayName) {
      userAttributes.push({ Name: 'name', Value: normalizedDisplayName });
    }

    return this.cognitoPost('SignUp', {
      ClientId: this.config.clientId,
      Username: email.trim(),
      Password: password,
      UserAttributes: userAttributes
    }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse | Error) => throwError(() => new Error(this.authErrorMessage(error))))
    );
  }

  confirmSignUp(email: string, confirmationCode: string): Observable<void> {
    return this.cognitoPost('ConfirmSignUp', {
      ClientId: this.config.clientId,
      Username: email.trim(),
      ConfirmationCode: confirmationCode.trim()
    }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse | Error) => throwError(() => new Error(this.authErrorMessage(error))))
    );
  }

  resendConfirmationCode(email: string): Observable<void> {
    return this.cognitoPost('ResendConfirmationCode', {
      ClientId: this.config.clientId,
      Username: email.trim()
    }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse | Error) => throwError(() => new Error(this.authErrorMessage(error))))
    );
  }

  completeCallback(_code: string, _returnedState: string): Observable<void> {
    return throwError(() => new Error('Hosted UI callback is no longer used. Please sign in from the FitSync login page.'));
  }

  logout(): void {
    this.clearSession();
    window.location.assign('/auth/login');
  }

  completeLogout(): void {
    this.clearSession();
  }

  private cognitoPost<T>(operation: string, payload: object): Observable<T> {
    return this.http.post<T>(this.config.apiEndpoint, payload, {
      headers: new HttpHeaders({
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${operation}`
      })
    });
  }

  private bootstrapWithCognitoToken(cognitoAccessToken: string): Observable<void> {
    return this.http
      .post<BootstrapAuthResponse>(
        '/api/v1/auth/bootstrap',
        {},
        {
          headers: new HttpHeaders({
            Authorization: `Bearer ${cognitoAccessToken}`
          })
        }
      )
      .pipe(
        tap((auth) => this.storeBootstrapToken(auth)),
        map(() => undefined)
      );
  }

  private storeCognitoTokens(tokens: CognitoTokenSet): void {
    localStorage.setItem(AUTH_STORAGE_KEYS.cognitoAccessToken, tokens.AccessToken);
    if (tokens.IdToken) {
      localStorage.setItem(AUTH_STORAGE_KEYS.cognitoIdToken, tokens.IdToken);
    }
    if (tokens.RefreshToken) {
      localStorage.setItem(AUTH_STORAGE_KEYS.cognitoRefreshToken, tokens.RefreshToken);
    }
  }

  private storeBootstrapToken(auth: BootstrapAuthResponse): void {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, auth.accessToken);
    localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(this.jwtExpiresAt(auth.accessToken) ?? Date.now() + 2 * 60 * 60 * 1000));
  }

  private clearSession(): void {
    this.clearLocalAccessToken();
    localStorage.removeItem(AUTH_STORAGE_KEYS.cognitoAccessToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.cognitoIdToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.cognitoRefreshToken);
  }

  private clearLocalAccessToken(): void {
    localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.idToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.expiresAt);
  }

  private jwtExpiresAt(token: string): number | null {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    try {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const normalized = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
      const decoded = JSON.parse(atob(normalized));
      return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private authErrorMessage(error: HttpErrorResponse | Error): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Unable to reach Cognito or FitSync backend. Check network and local gateway.';
      }

      const cognitoMessage = this.cognitoErrorMessage(error);
      if (cognitoMessage) {
        return cognitoMessage;
      }
    }

    return error.message || 'Authentication failed. Please try again.';
  }

  private cognitoErrorMessage(error: HttpErrorResponse): string | null {
    const body = error.error as { message?: string; __type?: string } | string | null;
    if (typeof body === 'string') {
      return body;
    }

    const code = body?.__type?.split('#').pop();
    const message = body?.message;

    if (code === 'UserNotConfirmedException') {
      return 'Please confirm your email before signing in.';
    }
    if (code === 'NotAuthorizedException') {
      return 'Invalid email or password.';
    }
    if (code === 'InvalidParameterException' && message?.includes('USER_PASSWORD_AUTH')) {
      return 'Cognito app client must enable USER_PASSWORD_AUTH for custom sign-in.';
    }

    return message ?? null;
  }
}
