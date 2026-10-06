import { Routes } from '@angular/router';

import { adminGuard, authGuard } from './core/auth/auth.guard';
import { AuthCallbackPage } from './features/auth/auth-callback.page';
import { LoginPage } from './features/auth/login.page';
import { LogoutCallbackPage } from './features/auth/logout-callback.page';
import { cookLeaveGuard } from './features/nutrition/cook/cook-leave.guard';
import { progressTabRedirect } from './features/progress/progress-redirect.guard';

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
    path: 'workout/plans/new',
    loadComponent: () => import('./features/workout/plan-flow/plan-flow.page').then((module) => module.PlanFlowPage),
    canActivate: [authGuard],
    title: 'FitSync New plan'
  },
  {
    path: 'workout/plans/:id/edit',
    loadComponent: () => import('./features/workout/plan-flow/plan-flow.page').then((module) => module.PlanFlowPage),
    canActivate: [authGuard],
    title: 'FitSync Edit plan'
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
    path: 'nutrition/nutrients',
    loadComponent: () => import('./features/nutrition/nutrients/nutrients.page').then((module) => module.NutrientsPage),
    canActivate: [authGuard],
    title: 'FitSync All nutrients'
  },
  {
    path: 'nutrition/nutrients/:code',
    loadComponent: () => import('./features/nutrition/nutrients/nutrient.page').then((module) => module.NutrientPage),
    canActivate: [authGuard],
    title: 'FitSync Nutrient'
  },
  {
    path: 'nutrition/recipes/:id/cook',
    loadComponent: () => import('./features/nutrition/cook/cook.page').then((module) => module.CookPage),
    canActivate: [authGuard],
    canDeactivate: [cookLeaveGuard],
    title: 'FitSync Cook mode'
  },
  {
    path: 'nutrition/recipes/new',
    loadComponent: () => import('./features/nutrition/recipes/recipe-editor.page').then((module) => module.RecipeEditorPage),
    canActivate: [authGuard],
    title: 'FitSync New recipe'
  },
  {
    path: 'nutrition/recipes/:id/edit',
    loadComponent: () => import('./features/nutrition/recipes/recipe-editor.page').then((module) => module.RecipeEditorPage),
    canActivate: [authGuard],
    title: 'FitSync Edit recipe'
  },
  {
    path: 'nutrition/recipes/:id',
    loadComponent: () => import('./features/nutrition/recipes/recipe.page').then((module) => module.RecipePage),
    canActivate: [authGuard],
    title: 'FitSync Recipe'
  },
  {
    path: 'progress/goal',
    loadComponent: () => import('./features/progress/goal/goal.page').then((module) => module.GoalPage),
    canActivate: [authGuard],
    title: 'FitSync Goal'
  },
  {
    path: 'progress/food',
    loadComponent: () => import('./features/progress/food/food.page').then((module) => module.FoodPage),
    canActivate: [authGuard],
    title: 'FitSync Food'
  },
  // The weekly reviews are the Earlier weeks sheet on Progress now; old links land there.
  { path: 'progress/reviews', pathMatch: 'full', redirectTo: 'progress' },
  {
    // The Training page, an activity and an exercise: /progress/training, /activities/:key and
    // /exercises/:exerciseId under it.
    path: 'progress/training',
    loadChildren: () => import('./features/progress/training/training.routes').then((module) => module.TRAINING_ROUTES),
    canActivate: [authGuard]
  },
  {
    // One page with a jump bar. The old tabs redirect: ?tab=body and ?tab=goals open the Goal page.
    path: 'progress',
    pathMatch: 'full',
    loadComponent: () => import('./features/progress/progress.page').then((module) => module.ProgressPage),
    canActivate: [authGuard, progressTabRedirect],
    title: 'FitSync Progress'
  },
  // Body metrics moved to the Goal page; old /body links and bookmarks still arrive there.
  { path: 'body', pathMatch: 'full', redirectTo: 'progress/goal' },
  {
    path: 'me/achievements',
    loadComponent: () => import('./features/profile/achievements/achievements.page').then((module) => module.AchievementsPage),
    canActivate: [authGuard],
    title: 'FitSync Achievements'
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
  {
    // An unknown address shows the shared placeholder inside the app frame. The guard still sends
    // visitors who are not signed in to the sign-in page.
    path: '**',
    loadComponent: () => import('./shared/pages/placeholder.page').then((module) => module.PlaceholderPage),
    canActivate: [authGuard],
    data: { placeholder: 'missing' },
    title: 'FitSync Page not found'
  }
];
