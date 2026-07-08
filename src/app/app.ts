import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AccountDataService, AccountSummary } from './core/account-data.service';
import { AuthService } from './core/auth/auth.service';
import { ThemeService } from './core/theme/theme.service';
import { ToastOutletComponent } from './shared/toast-outlet.component';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastOutletComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly accountDataService = inject(AccountDataService);
  protected readonly themeService = inject(ThemeService);

  protected readonly accountMenuOpen = signal(false);
  protected readonly account = signal<AccountSummary | null>(null);
  private readonly accountLoading = signal(false);

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

  ngOnInit(): void {
    this.loadAccountIfNeeded();
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => this.loadAccountIfNeeded());
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
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  protected closeAccountMenuFromDocument(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.accountMenuOpen() && !target?.closest('.account-menu')) {
      this.closeAccountMenu();
    }
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
