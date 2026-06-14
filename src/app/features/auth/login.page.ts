import { Component, inject, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPage {
  private readonly authService = inject(AuthService);

  readonly loading = signal<'login' | 'signup' | null>(null);
  readonly error = signal<string | null>(null);

  async signIn(): Promise<void> {
    await this.start('login');
  }

  async register(): Promise<void> {
    await this.start('signup');
  }

  private async start(mode: 'login' | 'signup'): Promise<void> {
    this.loading.set(mode);
    this.error.set(null);

    try {
      await this.authService.startLogin(mode === 'signup' ? 'signup' : undefined);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to start authentication.');
      this.loading.set(null);
    }
  }
}
