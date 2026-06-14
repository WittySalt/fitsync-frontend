import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback-page',
  imports: [RouterLink],
  template: `
    <main class="callback-page">
      <section class="summary-card">
        <p class="eyebrow">Authentication</p>
        <h1>{{ error() ? 'Sign-in failed' : 'Completing sign-in' }}</h1>
        <p>{{ error() || 'Finishing Cognito token exchange and FitSync bootstrap.' }}</p>
        @if (error()) {
          <a class="button primary" routerLink="/auth/login">Back to sign in</a>
        }
      </section>
    </main>
  `,
  styles: `
    .callback-page {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--page-bg);
    }

    .summary-card {
      width: min(520px, 100%);
    }
  `
})
export class AuthCallbackPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') ?? '';
    const state = params.get('state') ?? '';

    this.authService.completeCallback(code, state).subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (error: Error) => this.error.set(error.message)
    });
  }
}
