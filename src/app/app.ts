import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  constructor(protected readonly router: Router) {}

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
}
