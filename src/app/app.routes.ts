import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { AuthCallbackPage } from './features/auth/auth-callback.page';
import { LoginPage } from './features/auth/login.page';
import { LogoutCallbackPage } from './features/auth/logout-callback.page';
import { DashboardPage } from './features/dashboard/dashboard.page';
import { NutritionPage } from './features/nutrition/nutrition.page';
import { OnboardingPage } from './features/onboarding/onboarding.page';
import { SettingsPage } from './features/settings/settings.page';
import { WorkoutPage } from './features/workout/workout.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'auth/login', component: LoginPage, title: 'FitSync Sign In' },
  { path: 'auth/callback', component: AuthCallbackPage, title: 'FitSync Auth Callback' },
  { path: 'logout/callback', component: LogoutCallbackPage, title: 'FitSync Signed Out' },
  { path: 'dashboard', component: DashboardPage, canActivate: [authGuard], title: 'FitSync Dashboard' },
  { path: 'onboarding', component: OnboardingPage, canActivate: [authGuard], title: 'FitSync Onboarding' },
  { path: 'workout', component: WorkoutPage, canActivate: [authGuard], title: 'FitSync Workout' },
  { path: 'nutrition', component: NutritionPage, canActivate: [authGuard], title: 'FitSync Nutrition' },
  {
    path: 'progress',
    loadComponent: () => import('./features/progress/progress.page').then((module) => module.ProgressPage),
    canActivate: [authGuard],
    title: 'FitSync Progress'
  },
  { path: 'me', component: SettingsPage, canActivate: [authGuard], title: 'FitSync Settings' },
  { path: 'settings', component: SettingsPage, canActivate: [authGuard], title: 'FitSync Settings' },
  { path: '**', redirectTo: 'dashboard' }
];
