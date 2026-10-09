import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import {
  EMPTY,
  catchError,
  defer,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  Subscription,
  switchMap,
  tap,
  throwError,
  timeout
} from 'rxjs';

import {
  AUTH_STORAGE_KEYS,
  buildSocialAuthorizeUrl,
  COGNITO_AUTH_CONFIG,
  SOCIAL_SIGN_IN_ENABLED,
  SocialProvider
} from './auth.config';
import { currentDeviceLabel } from './device-label';
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

/** The token fields that bootstrap and refresh share. An older backend sends the access token only. */
interface SessionTokens {
  accessToken: string;
  refreshToken?: string | null;
  accessTokenExpiresAt?: string | null;
  sessionId?: string | null;
}

interface BootstrapAuthResponse extends SessionTokens {
  tokenType: string;
}

export const AUTH_REFRESH_URL = '/api/v1/auth/refresh';
export const AUTH_LOGOUT_URL = '/api/v1/auth/logout';
export const SESSION_REVOKED_CODE = 'SESSION_REVOKED';
export const SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';

/** Why this device lost its session, which decides the line the sign-in page shows. */
export type SessionEndReason = 'revoked' | 'expired';

/** Raised to callers of a refresh that ended the session, after the tokens were cleared. */
export class SessionEndedError extends Error {
  constructor(readonly reason: SessionEndReason) {
    super(reason === 'revoked' ? 'This device was signed out.' : 'The session ended.');
    this.name = 'SessionEndedError';
  }
}

/** The `code` of a standard ApiError body, or null when the response has none. */
export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = error.error as { code?: unknown } | null;
  return typeof body?.code === 'string' ? body.code : null;
}

/**
 * Runs a token refresh while no other tab of this browser runs one. Tabs share the stored
 * refresh token, which rotates on every use, so two tabs must not spend the same one.
 * Without the Web Locks API the refresh runs straight away.
 */
export type RefreshLock = <T>(work: () => Observable<T>) => Observable<T>;

const REFRESH_LOCK_NAME = 'fitsync.auth.refresh';

export const webLocksRefreshLock: RefreshLock = <T>(work: () => Observable<T>): Observable<T> => {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) {
    return defer(work);
  }
  return new Observable<T>((subscriber) => {
    let inner: Subscription | undefined;
    locks
      .request(
        REFRESH_LOCK_NAME,
        () =>
          new Promise<void>((release) => {
            if (subscriber.closed) {
              release();
              return;
            }
            inner = defer(work)
              .pipe(finalize(() => release()))
              .subscribe(subscriber);
          })
      )
      .catch((error: unknown) => subscriber.error(error));
    return () => inner?.unsubscribe();
  });
};

export const AUTH_REFRESH_LOCK = new InjectionToken<RefreshLock>('AUTH_REFRESH_LOCK', {
  providedIn: 'root',
  factory: () => webLocksRefreshLock
});

// The access token is refreshed this long before it expires.
const REFRESH_LEAD_MS = 60_000;
const REFRESH_TIMEOUT_MS = 15_000;
const LOGOUT_TIMEOUT_MS = 3_000;
// A token whose expiry cannot be read is treated as valid for two hours, as before refresh existed.
const FALLBACK_TOKEN_LIFETIME_MS = 2 * 60 * 60 * 1000;

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
  private readonly refreshLock = inject(AUTH_REFRESH_LOCK);
  private readonly config = COGNITO_AUTH_CONFIG;
  private sessionBootstrap$?: Observable<boolean>;
  private refreshInFlight$?: Observable<string>;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  // Several failing calls can learn at once that the session is gone. Only the first one acts.
  private sessionEnding = false;
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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelRefreshTimer());
    // A reload keeps the stored tokens, so the refresh is planned again.
    this.scheduleRefresh();
  }

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

  /**
   * Whether this session can be refreshed. An older backend sends no refresh token, and then the
   * app keeps its earlier behaviour: no refresh, and a new bootstrap once the token has expired.
   */
  hasRefreshToken(): boolean {
    return Boolean(localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken));
  }

  ensureSession(): Observable<boolean> {
    if (this.isAuthenticated()) {
      return of(true);
    }

    if (this.hasRefreshToken()) {
      return this.refreshAccessToken(localStorage.getItem(AUTH_STORAGE_KEYS.accessToken)).pipe(
        map(() => true),
        catchError(() => of(false))
      );
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
      // An unknown email is answered like a known one, so the reset form never tells anyone
      // which emails have an account.
      catchError((error: HttpErrorResponse | Error) =>
        this.cognitoErrorCode(error) === 'UserNotFoundException'
          ? of(undefined)
          : throwError(() => new Error(this.authErrorMessage(error)))
      )
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

  /**
   * Returns a fresh access token. Concurrent callers share one refresh call. `staleAccessToken` is
   * the token the caller holds: when storage already has a different, valid one, because this or
   * another tab refreshed in the meantime, that one is used and no call is made.
   *
   * A refresh refused with 401 ends the session: the tokens are cleared, the person is sent to the
   * sign-in page, and the observable fails with SessionEndedError. Other failures keep the tokens.
   */
  refreshAccessToken(staleAccessToken: string | null): Observable<string> {
    this.refreshInFlight$ ??= this.refreshLock(() => this.rotateTokens(staleAccessToken)).pipe(
      finalize(() => {
        this.refreshInFlight$ = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    return this.refreshInFlight$;
  }

  /** Clears the session of a device that was signed out or whose session ended, and opens the sign-in page. */
  endSession(reason: SessionEndReason): void {
    if (this.sessionEnding) {
      return;
    }
    this.sessionEnding = true;
    this.clearSession();
    this.navigateToLogin(reason);
  }

  /** Revokes this device's session on the server when it can, then signs out here as before. */
  logout(): void {
    const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
    const finish = (): void => {
      this.clearSession();
      this.navigateToLogin();
    };
    if (!accessToken) {
      finish();
      return;
    }
    // The header is set here so the interceptor neither refreshes nor retries this call.
    // Any failure is ignored: the local sign-out happens whatever the server says.
    this.http
      .post<void>(AUTH_LOGOUT_URL, null, { headers: new HttpHeaders({ Authorization: `Bearer ${accessToken}` }) })
      .pipe(timeout(LOGOUT_TIMEOUT_MS), finalize(finish))
      .subscribe({ error: () => undefined });
  }

  /** Opens the sign-in page with a full reload, which also drops every cache held in memory. */
  navigateToLogin(reason?: SessionEndReason): void {
    window.location.assign(reason ? `/auth/login?signedOut=${reason}` : '/auth/login');
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
            Authorization: `Bearer ${cognitoIdToken}`,
            'X-Device-Label': currentDeviceLabel()
          })
        }
      )
      .pipe(
        tap((auth) => this.storeSessionTokens(auth)),
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

  /**
   * Spends the stored refresh token, unless storage already holds a different valid access token.
   * After a refused refresh it looks at storage once more, because another tab may have rotated
   * the refresh token while this call was on its way.
   */
  private rotateTokens(staleAccessToken: string | null): Observable<string> {
    const storedAccessToken = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
    if (storedAccessToken && storedAccessToken !== staleAccessToken && this.isAuthenticated()) {
      this.adoptStoredTokens(storedAccessToken);
      return of(storedAccessToken);
    }

    const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
    if (!refreshToken) {
      return throwError(() => new Error('This session cannot be refreshed.'));
    }

    return this.http.post<SessionTokens>(AUTH_REFRESH_URL, { refreshToken }).pipe(
      timeout(REFRESH_TIMEOUT_MS),
      map((tokens) => {
        if (!tokens?.accessToken) {
          throw new Error('The refresh response had no access token.');
        }
        this.storeSessionTokens(tokens);
        return tokens.accessToken;
      }),
      catchError((error: unknown) => {
        const rotatedRefreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
        const currentAccessToken = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
        if (rotatedRefreshToken && rotatedRefreshToken !== refreshToken && currentAccessToken && this.isAuthenticated()) {
          this.adoptStoredTokens(currentAccessToken);
          return of(currentAccessToken);
        }
        if (error instanceof HttpErrorResponse && error.status === 401) {
          const reason: SessionEndReason = apiErrorCode(error) === SESSION_REVOKED_CODE ? 'revoked' : 'expired';
          this.endSession(reason);
          return throwError(() => new SessionEndedError(reason));
        }
        return throwError(() => error);
      })
    );
  }

  /** Takes up tokens another tab stored, so this tab's role and refresh timer follow them. */
  private adoptStoredTokens(accessToken: string): void {
    this.tokenRole.set(roleFromAccessToken(accessToken));
    this.scheduleRefresh();
  }

  private storeSessionTokens(tokens: SessionTokens): void {
    this.sessionEnding = false;
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, tokens.accessToken);
    this.tokenRole.set(roleFromAccessToken(tokens.accessToken));
    if (tokens.refreshToken) {
      localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, tokens.refreshToken);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    }
    const expiresAt =
      this.instantMillis(tokens.accessTokenExpiresAt) ??
      this.jwtExpiresAt(tokens.accessToken) ??
      Date.now() + FALLBACK_TOKEN_LIFETIME_MS;
    localStorage.setItem(AUTH_STORAGE_KEYS.expiresAt, String(expiresAt));
    this.scheduleRefresh();
  }

  /** Plans a refresh shortly before the stored access token expires. Nothing is planned without a refresh token. */
  private scheduleRefresh(): void {
    this.cancelRefreshTimer();
    const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
    const expiresAt = Number(localStorage.getItem(AUTH_STORAGE_KEYS.expiresAt) ?? 0);
    if (!accessToken || !expiresAt || !this.hasRefreshToken()) {
      return;
    }
    const delay = Math.max(expiresAt - Date.now() - REFRESH_LEAD_MS, 0);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      // A failure is left to the next request, which refreshes on its own or meets a 401.
      this.refreshAccessToken(accessToken).subscribe({ error: () => undefined });
    }, delay);
  }

  private cancelRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private instantMillis(instant: string | null | undefined): number | null {
    if (!instant) {
      return null;
    }
    const millis = Date.parse(instant);
    return Number.isNaN(millis) ? null : millis;
  }

  private clearSession(): void {
    this.sessionBootstrap$ = undefined;
    this.cancelRefreshTimer();
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

  private cognitoErrorCode(error: HttpErrorResponse | Error): string | undefined {
    if (!(error instanceof HttpErrorResponse)) {
      return undefined;
    }
    const body = error.error as { __type?: string } | string | null;
    return typeof body === 'string' ? undefined : body?.__type?.split('#').pop();
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

    return message ?? null;
  }
}
