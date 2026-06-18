import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { AuthCallbackPage } from './features/auth/auth-callback.page';
import { LoginPage } from './features/auth/login.page';
import { LogoutCallbackPage } from './features/auth/logout-callback.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: 'auth/login', component: LoginPage, title: 'FitSync Sign In' },
  { path: 'auth/callback', component: AuthCallbackPage, title: 'FitSync Auth Callback' },
  { path: 'logout/callback', component: LogoutCallbackPage, title: 'FitSync Signed Out' },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.page').then((module) => module.DashboardPage),
    canActivate: [authGuard],
    title: 'FitSync Dashboard'
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.page').then((module) => module.OnboardingPage),
    canActivate: [authGuard],
    title: 'FitSync Onboarding'
  },
  {
    path: 'workout',
    loadComponent: () => import('./features/workout/workout.page').then((module) => module.WorkoutPage),
    canActivate: [authGuard],
    title: 'FitSync Workout'
  },
  {
    path: 'nutrition',
    loadComponent: () => import('./features/nutrition/nutrition.page').then((module) => module.NutritionPage),
    canActivate: [authGuard],
    title: 'FitSync Nutrition'
  },
  {
    path: 'progress',
    loadComponent: () => import('./features/progress/progress.page').then((module) => module.ProgressPage),
    canActivate: [authGuard],
    title: 'FitSync Progress'
  },
  {
    path: 'me',
    loadComponent: () => import('./features/settings/settings.page').then((module) => module.SettingsPage),
    canActivate: [authGuard],
    title: 'FitSync Settings'
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then((module) => module.SettingsPage),
    canActivate: [authGuard],
    title: 'FitSync Settings'
  },
  { path: '**', redirectTo: 'dashboard' }
];
