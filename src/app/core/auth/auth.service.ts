import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

import {
  AUTH_STORAGE_KEYS,
  buildSocialAuthorizeUrl,
  COGNITO_AUTH_CONFIG,
  SOCIAL_SIGN_IN_ENABLED,
  SocialProvider
} from './auth.config';
import { normalizeRole, roleFromAccessToken, UserRole } from './jwt-role';

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

/** An account whose deletion is scheduled. The date is null when the backend did not send one. */
export interface PendingDeletion {
  scheduledFor: string | null;
}

const DELETION_PENDING_CODE = 'ACCOUNT_DELETION_PENDING';

function deletionPendingFrom(error: HttpErrorResponse | Error): PendingDeletion | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) {
    return null;
  }
  const body = error.error as { code?: unknown; data?: { scheduledFor?: unknown } | null } | null;
  if (body?.code !== DELETION_PENDING_CODE) {
    return null;
  }
  const scheduledFor = body.data?.scheduledFor;
  return { scheduledFor: typeof scheduledFor === 'string' ? scheduledFor : null };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = COGNITO_AUTH_CONFIG;
  private sessionBootstrap$?: Observable<boolean>;
  // The Cognito tokens of an account that was refused a session because its deletion is pending.
  // They stay in memory only, so that the person can keep the account without signing in again.
  private pendingDeletionTokens: CognitoTokenSet | null = null;

  readonly authError = signal<string | null>(null);

  /** Set while a sign-in is held back because the account is scheduled for deletion. */
  readonly pendingDeletion = signal<PendingDeletion | null>(null);

  /** Whether the account can be restored from here, which needs the tokens of a sign-in made in this page. */
  readonly canCancelAccountDeletion = signal(false);

  // The current-user response is the trusted source for the role. The role claim of the stored
  // application token covers the moment before that response has arrived, on a reload for example.
  private readonly tokenRole = signal<UserRole | null>(roleFromAccessToken(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)));
  private readonly userRole = signal<UserRole | null>(null);

  /** The signed-in user's role, or null while it is unknown. It decides what the UI shows, never what is allowed. */
  readonly role = computed(() => this.userRole() ?? this.tokenRole());
  readonly isAdmin = computed(() => this.role() === 'ADMIN');

  /** Whether federated Google/Apple sign-in is wired up (see AUTH-SOCIAL-SIGNIN.md). */
  readonly socialSignInEnabled = SOCIAL_SIGN_IN_ENABLED;

  /**
   * Redirect into the Cognito Hosted UI for a federated provider. No-op while
   * social sign-in is disabled so callers can bind it unconditionally; the
   * login page keeps the buttons disabled until the seam is turned on.
   */
  beginSocialSignIn(provider: SocialProvider): void {
    if (!this.socialSignInEnabled) {
      return;
    }
    window.location.assign(buildSocialAuthorizeUrl(this.config, provider));
  }

  /** Records the role from the current-user response; a response without a role keeps the token's claim. */
  setUserRole(role: string | null | undefined): void {
    this.userRole.set(normalizeRole(role));
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
    const expiresAt = Number(localStorage.getItem(AUTH_STORAGE_KEYS.expiresAt) ?? 0);
    return Boolean(token && expiresAt > Date.now());
  }

  getAccessToken(): string | null {
    return this.isAuthenticated() ? localStorage.getItem(AUTH_STORAGE_KEYS.accessToken) : null;
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

    this.sessionBootstrap$ ??= this.bootstrapWithCognitoToken(cognitoIdToken).pipe(
      map(() => true),
      catchError(() => {
        this.clearSession();
        return of(false);
      }),
      finalize(() => {
        this.sessionBootstrap$ = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    return this.sessionBootstrap$;
  }

  signIn(email: string, password: string): Observable<void> {
    this.authError.set(null);
    this.dismissPendingDeletion();
    this.clearSession();
    let signedInTokens: CognitoTokenSet | null = null;

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

        signedInTokens = tokens;
        this.storeCognitoTokens(tokens);
        return this.bootstrapWithCognitoToken(tokens.IdToken);
      }),
      catchError((error: HttpErrorResponse | Error) => {
        this.clearSession();
        const pending = deletionPendingFrom(error);
        if (pending && signedInTokens) {
          // The sign-in itself worked, so the person is not shown an error. They are asked whether to keep the account.
          this.pendingDeletionTokens = signedInTokens;
          this.canCancelAccountDeletion.set(true);
          this.pendingDeletion.set(pending);
          return EMPTY;
        }
        return throwError(() => new Error(this.authErrorMessage(error)));
      })
    );
  }

  /** Remembers that the account just asked to be deleted, for the sign-in page to explain. No tokens are kept. */
  noteDeletionRequested(scheduledFor: string | null): void {
    this.dismissPendingDeletion();
    this.pendingDeletion.set({ scheduledFor });
  }

  /**
   * Restores an account whose deletion is pending and signs the person in. The held Cognito tokens are
   * dropped once the account is restored or can no longer be, and kept after any other failure so the
   * person can try again.
   */
  cancelAccountDeletion(): Observable<void> {
    const tokens = this.pendingDeletionTokens;
    if (!tokens?.IdToken) {
      return throwError(() => new Error('Sign in again to keep this account.'));
    }
    const identityToken = tokens.IdToken;

    return this.http
      .post<unknown>(
        '/api/v1/auth/account-deletion/cancel',
        null,
        { headers: new HttpHeaders({ Authorization: `Bearer ${identityToken}` }) }
      )
      .pipe(
        switchMap(() => this.bootstrapWithCognitoToken(identityToken)),
        tap(() => {
          this.storeCognitoTokens(tokens);
          this.dismissPendingDeletion();
        }),
        catchError((error: HttpErrorResponse | Error) => {
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.dismissPendingDeletion();
            return throwError(() => new Error('This account can no longer be restored.'));
          }
          return throwError(() => new Error('The account could not be restored. Try again.'));
        })
      );
  }

  /** Drops the held tokens and the notice, for the person who goes back to the sign-in form. */
  dismissPendingDeletion(): void {
    this.pendingDeletionTokens = null;
    this.canCancelAccountDeletion.set(false);
    this.pendingDeletion.set(null);
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

  forgotPassword(email: string): Observable<void> {
    return this.cognitoPost('ForgotPassword', {
      ClientId: this.config.clientId,
      Username: email.trim()
    }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse | Error) => throwError(() => new Error(this.authErrorMessage(error))))
    );
  }

  confirmForgotPassword(email: string, confirmationCode: string, newPassword: string): Observable<void> {
    return this.cognitoPost('ConfirmForgotPassword', {
      ClientId: this.config.clientId,
      Username: email.trim(),
      ConfirmationCode: confirmationCode.trim(),
      Password: newPassword
    }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse | Error) => throwError(() => new Error(this.authErrorMessage(error))))
    );
  }

  changePassword(previousPassword: string, proposedPassword: string): Observable<void> {
    return this.cognitoPostWithAccessToken('ChangePassword', {
      PreviousPassword: previousPassword,
      ProposedPassword: proposedPassword
    }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse | Error) => throwError(() => new Error(this.authErrorMessage(error))))
    );
  }

  signOutEverywhere(): Observable<void> {
    return this.cognitoPostWithAccessToken('GlobalSignOut', {}).pipe(
      tap(() => this.logout()),
      map(() => undefined),
      catchError((error: HttpErrorResponse | Error) => throwError(() => new Error(this.authErrorMessage(error))))
    );
  }

  deleteAccount(): Observable<void> {
    return this.cognitoPostWithAccessToken('DeleteUser', {}).pipe(
      tap(() => this.logout()),
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

  private cognitoPostWithAccessToken<T>(operation: string, payload: object): Observable<T> {
    const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.cognitoAccessToken);
    if (!accessToken) {
      return throwError(() => new Error('Cognito session has expired. Please sign in again.'));
    }

    return this.cognitoPost<T>(operation, {
      AccessToken: accessToken,
      ...payload
    });
  }

  /** Trades a Cognito ID token for the application token the backend API accepts. */
  private bootstrapWithCognitoToken(cognitoIdToken: string): Observable<void> {
    return this.http
      .post<BootstrapAuthResponse>(
        '/api/v1/auth/bootstrap',
        {},
        {
          headers: new HttpHeaders({
            Authorization: `Bearer ${cognitoIdToken}`
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
    this.tokenRole.set(roleFromAccessToken(auth.accessToken));
    // A token without a readable `exp` claim is treated as valid for two hours.
    localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(this.jwtExpiresAt(auth.accessToken) ?? Date.now() + 2 * 60 * 60 * 1000));
  }

  private clearSession(): void {
    this.sessionBootstrap$ = undefined;
    this.userRole.set(null);
    this.clearLocalAccessToken();
    localStorage.removeItem(AUTH_STORAGE_KEYS.cognitoAccessToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.cognitoIdToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.cognitoRefreshToken);
  }

  private clearLocalAccessToken(): void {
    this.tokenRole.set(null);
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
    if (code === 'CodeMismatchException') {
      return 'That code is incorrect. Check your email and try again.';
    }
    if (code === 'ExpiredCodeException') {
      return 'That code has expired. Request a new one and try again.';
    }
    if (code === 'InvalidPasswordException') {
      return message ?? 'Your new password does not meet the requirements.';
    }
    if (code === 'LimitExceededException') {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (code === 'UserNotFoundException') {
      return 'If that email has an account, a reset code is on its way.';
    }

    return message ?? null;
  }
}
