import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-logout-callback-page',
  imports: [RouterLink],
  template: `
    <main class="callback-page">
      <section class="summary-card">
        <p class="eyebrow">Signed out</p>
        <h1>You are signed out</h1>
        <p>Your local FitSync session has been cleared.</p>
        <a class="button primary" routerLink="/auth/login">Sign in again</a>
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
export class LogoutCallbackPage implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.authService.completeLogout();
    // A short pause so the signed-out message can be read before the login page replaces it.
    setTimeout(() => this.router.navigateByUrl('/auth/login'), 1200);
  }
}
