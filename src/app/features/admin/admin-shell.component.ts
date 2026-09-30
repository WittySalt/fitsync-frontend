import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';

/**
 * The admin area has a layout of its own, so it never shows the member navigation. An administrator
 * has no member pages to go back to, so the way out of the console is to sign out.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-shell.component.html',
  styleUrl: './admin-shell.component.scss'
})
export class AdminShellComponent {
  private readonly authService = inject(AuthService);

  protected signOut(): void {
    this.authService.logout();
  }
}
