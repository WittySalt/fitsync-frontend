import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';

import { AdminAction } from './admin-action';
import { AdminActionStatusComponent } from './admin-action-status.component';
import { UserTimezoneService } from '../../core/user-timezone.service';
import { AdminApiService, AdminUser, RebuildResult } from './admin-api.service';
import { AdminConfirmButtonComponent } from './admin-confirm-button.component';
import { EMAIL_MAX_LENGTH, formatClock, isDateKeyUpTo, looksLikeEmail, titleCase } from './admin-format';

type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; user: AdminUser }
  | { kind: 'invalid' }
  | { kind: 'not-found' }
  | { kind: 'forbidden' }
  | { kind: 'failed' };

const LOOKUP_MESSAGES: Partial<Record<LookupState['kind'], string>> = {
  invalid: 'Enter a valid email address.',
  'not-found': 'No account has this email.',
  failed: 'The search did not work. Try again.'
};

/** The line that reports a rebuild: the time it finished, on a 24 hour clock. */
export function rebuiltMessage(result: RebuildResult, now: Date): string {
  return `Rebuilt at ${formatClock(result.rebuiltAt) ?? formatClock(now)}.`;
}

interface Field {
  label: string;
  value: string;
  mono?: boolean;
}

@Component({
  selector: 'app-admin-user-data-page',
  imports: [AdminConfirmButtonComponent, AdminActionStatusComponent],
  templateUrl: './user-data.page.html',
  styleUrls: ['./admin-page.scss', './user-data.page.scss']
})
export class UserDataPage {
  private readonly api = inject(AdminApiService);
  private readonly userTimezone = inject(UserTimezoneService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly search$ = new Subject<string>();

  protected readonly emailMaxLength = EMAIL_MAX_LENGTH;
  // The latest date the rebuilds accept is today where the administrator is.
  protected readonly today = this.userTimezone.dateKey();
  protected readonly date = signal(this.today);
  protected readonly email = signal('');
  protected readonly lookup = signal<LookupState>({ kind: 'idle' });

  protected readonly dashboard = new AdminAction();
  protected readonly nutrition = new AdminAction();
  protected readonly workouts = new AdminAction();
  protected readonly goals = new AdminAction();

  protected readonly user = computed(() => {
    const state = this.lookup();
    return state.kind === 'found' ? state.user : null;
  });

  protected readonly fields = computed<Field[]>(() => {
    const user = this.user();
    if (!user) {
      return [];
    }
    return [
      { label: 'Name', value: user.displayName || '-' },
      { label: 'Email', value: user.email || '-' },
      { label: 'Role', value: titleCase(user.role) || '-' },
      { label: 'Sign-in', value: titleCase(user.authProvider) || '-' },
      { label: 'User ID', value: user.userId || '-', mono: true }
    ];
  });

  protected readonly forbidden = computed(() => this.lookup().kind === 'forbidden');
  protected readonly lookupMessage = computed(() => LOOKUP_MESSAGES[this.lookup().kind] ?? null);
  protected readonly searching = computed(() => this.lookup().kind === 'loading');
  protected readonly dateValid = computed(() => isDateKeyUpTo(this.date(), this.today));

  constructor() {
    this.search$
      .pipe(
        switchMap((email) =>
          this.api.lookupUser(email).pipe(
            map((user): LookupState => ({ kind: 'found', user })),
            catchError((error: unknown) => of<LookupState>(this.lookupFailure(error))),
            startWith<LookupState>({ kind: 'loading' })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((state) => this.lookup.set(state));
  }

  protected changeEmail(value: string): void {
    this.email.set(value);
    // The found user is dropped as soon as the input names another address, so the page never shows someone the search no longer matches.
    const user = this.user();
    if (user && value.trim().toLowerCase() !== user.email.toLowerCase()) {
      this.forgetUser();
    }
  }

  protected changeDate(value: string): void {
    this.date.set(value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.find();
  }

  protected find(): void {
    if (this.searching()) {
      return;
    }
    const email = this.email().trim();
    this.forgetUser();
    if (!looksLikeEmail(email)) {
      this.lookup.set({ kind: 'invalid' });
      return;
    }
    this.search$.next(email);
  }

  protected rebuildDashboard(user: AdminUser): void {
    this.dashboard.run(() => this.api.rebuildDashboard(user.userId), (result) => rebuiltMessage(result, new Date()));
  }

  protected rebuildNutrition(user: AdminUser): void {
    this.nutrition.run(() => this.api.rebuildNutrition(user.userId, this.date()), (result) => rebuiltMessage(result, new Date()));
  }

  protected rebuildWorkouts(user: AdminUser): void {
    this.workouts.run(() => this.api.rebuildWorkouts(user.userId, this.date()), (result) => rebuiltMessage(result, new Date()));
  }

  protected reconcileGoals(): void {
    this.goals.run(
      () => this.api.reconcileGoals(),
      (result) => `Published ${result.publishedCount} goal events.`
    );
  }

  private forgetUser(): void {
    this.lookup.set({ kind: 'idle' });
    this.dashboard.reset();
    this.nutrition.reset();
    this.workouts.reset();
  }

  private lookupFailure(error: unknown): LookupState {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 404) {
      return { kind: 'not-found' };
    }
    if (status === 400) {
      return { kind: 'invalid' };
    }
    return status === 403 ? { kind: 'forbidden' } : { kind: 'failed' };
  }
}
