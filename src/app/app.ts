import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AccountDataService, AccountSummary } from './core/account-data.service';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';
import { CoachStore } from './core/coach/coach.store';
import { CookBarComponent } from './features/nutrition/cook/cook-bar.component';
import { WorkoutBarComponent } from './features/workout/workout-bar.component';
import { WorkoutConflictDialogComponent } from './features/workout/workout-conflict-dialog.component';
import { WorkoutLiveService } from './features/workout/workout-live.service';
import { CoachDockComponent } from './shared/coach/coach-dock.component';
import { ToastOutletComponent } from './shared/toast-outlet.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ToastOutletComponent,
    CoachDockComponent,
    WorkoutBarComponent,
    CookBarComponent,
    WorkoutConflictDialogComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly router = inject(Router);
  protected readonly authService = inject(AuthService);
  private readonly accountDataService = inject(AccountDataService);
  protected readonly themeService = inject(ThemeService);
  protected readonly coach = inject(CoachStore);
  private readonly workoutLive = inject(WorkoutLiveService);

  protected readonly accountMenuOpen = signal(false);
  protected readonly account = signal<AccountSummary | null>(null);
  private readonly accountLoading = signal(false);
  private signedIn = false;
  private activeWorkoutRequested = false;

  protected readonly navItems = [
    { path: '/dashboard', label: 'Home', icon: 'home' },
    { path: '/workout', label: 'Workout', icon: 'dumbbell' },
    { path: '/nutrition', label: 'Nutrition', icon: 'bowl' },
    { path: '/progress', label: 'Progress', icon: 'chart' },
    { path: '/me', label: 'Me', icon: 'user' }
  ];

  protected isAuthRoute(): boolean {
    return this.router.url.startsWith('/auth') || this.router.url.startsWith('/logout');
  }

  /** The admin area brings its own layout, so the member navigation and coach dock stay out of it. */
  protected isAdminRoute(): boolean {
    return /^\/admin(?:[/?#]|$)/.test(this.router.url);
  }

  /** Cook mode is a full-screen view of its own, so the shell's navigation and docks stay out of it. */
  protected isCookRoute(): boolean {
    return /^\/nutrition\/recipes\/[^/?#]+\/cook(?:[/?#]|$)/.test(this.router.url);
  }

  ngOnInit(): void {
    this.loadAccountIfNeeded();
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.loadAccountIfNeeded();
      this.loadActiveWorkoutIfNeeded();
    });
  }

  protected toggleAccountMenu(): void {
    this.accountMenuOpen.update((open) => !open);
  }

  protected closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  protected toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  protected themeToggleLabel(): string {
    const activeTheme = this.themeService.theme();
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    if (this.themeService.preference() === 'system') {
      return `System theme (${activeTheme}). Switch to ${nextTheme} theme`;
    }
    return `Switch to ${nextTheme} theme`;
  }

  protected logout(): void {
    this.closeAccountMenu();
    this.workoutLive.reset();
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  protected closeAccountMenuFromDocument(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.accountMenuOpen() && !target?.closest('.account-menu')) {
      this.closeAccountMenu();
    }
  }

  /** The workout in progress is loaded once the shell knows who is signed in. The admin console and the
   *  signed-out pages never ask for it. */
  private loadActiveWorkoutIfNeeded(): void {
    if (this.activeWorkoutRequested || !this.signedIn || this.isAuthRoute() || this.isAdminRoute()) {
      return;
    }
    this.activeWorkoutRequested = true;
    this.workoutLive.refresh();
  }

  private loadAccountIfNeeded(): void {
    if (this.isAuthRoute() || this.account() || this.accountLoading()) {
      return;
    }

    this.accountLoading.set(true);
    this.authService.ensureSession().subscribe({
      next: (authenticated) => {
        if (!authenticated) {
          this.accountLoading.set(false);
          this.account.set(null);
          return;
        }
        this.signedIn = true;
        this.loadActiveWorkoutIfNeeded();

        this.accountDataService.getProfileSummary().subscribe({
          next: (account) => {
            this.account.set(account);
            this.accountLoading.set(false);
          },
          error: () => {
            this.accountLoading.set(false);
          }
        });
      },
      error: () => {
        this.accountLoading.set(false);
      }
    });
  }
}
