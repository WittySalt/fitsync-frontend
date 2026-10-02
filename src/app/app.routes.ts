import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth/auth.guard';
import { AuthCallbackPage } from './features/auth/auth-callback.page';
import { LoginPage } from './features/auth/login.page';
import { LogoutCallbackPage } from './features/auth/logout-callback.page';
import { cookLeaveGuard } from './features/nutrition/cook/cook-leave.guard';

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
    path: 'workout/sessions/:sessionId',
    loadComponent: () => import('./features/workout/session.page').then((module) => module.SessionPage),
    canActivate: [authGuard],
    title: 'FitSync Workout session'
  },
  {
    path: 'nutrition',
    loadComponent: () => import('./features/nutrition/nutrition.page').then((module) => module.NutritionPage),
    canActivate: [authGuard],
    title: 'FitSync Nutrition'
  },
  {
    path: 'nutrition/recipes/:id/cook',
    loadComponent: () => import('./features/nutrition/cook/cook.page').then((module) => module.CookPage),
    canActivate: [authGuard],
    canDeactivate: [cookLeaveGuard],
    title: 'FitSync Cook mode'
  },
  {
    path: 'progress',
    loadComponent: () => import('./features/progress/progress.page').then((module) => module.ProgressPage),
    canActivate: [authGuard],
    title: 'FitSync Progress'
  },
  {
    // Body metrics now live inside the Progress hub as a sub-tab. This alias keeps
    // existing /body links and bookmarks working: ProgressPage opens the Body tab
    // when the active URL is /body.
    path: 'body',
    loadComponent: () => import('./features/progress/progress.page').then((module) => module.ProgressPage),
    canActivate: [authGuard],
    title: 'FitSync Body Metrics'
  },
  {
    path: 'me',
    loadComponent: () => import('./features/profile/profile.page').then((module) => module.ProfilePage),
    canActivate: [authGuard],
    title: 'FitSync Profile'
  },
  {
    // Plan Studio: a generated session, editable, with the validator's findings shown rather than
    // hidden, and the accept button that turns it into a real plan and session.
    path: 'coach/plan',
    loadComponent: () => import('./features/coach/plan-studio.page').then((module) => module.PlanStudioPage),
    canActivate: [authGuard],
    title: 'FitSync Plan Studio'
  },
  {
    path: 'settings/avatar',
    loadComponent: () => import('./features/settings/avatar-upload.page').then((module) => module.AvatarUploadPage),
    canActivate: [authGuard],
    title: 'FitSync Profile Photo'
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.page').then((module) => module.SettingsPage),
    canActivate: [authGuard],
    title: 'FitSync Settings'
  },
  {
    // The admin area is a layout of its own. The guard only spares members a page that would show them
    // errors; the server refuses a member on every admin call.
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-shell.component').then((module) => module.AdminShellComponent),
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'coach-quality' },
      {
        path: 'coach-quality',
        loadComponent: () => import('./features/admin/coach-quality.page').then((module) => module.CoachQualityPage),
        title: 'FitSync Admin · Coach quality'
      },
      {
        path: 'catalogue',
        loadComponent: () => import('./features/admin/catalogue.page').then((module) => module.CataloguePage),
        title: 'FitSync Admin · Catalogue'
      },
      {
        path: 'users',
        loadComponent: () => import('./features/admin/user-data.page').then((module) => module.UserDataPage),
        title: 'FitSync Admin · User data'
      },
      {
        path: 'events',
        loadComponent: () => import('./features/admin/events.page').then((module) => module.EventsPage),
        title: 'FitSync Admin · Events'
      }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
