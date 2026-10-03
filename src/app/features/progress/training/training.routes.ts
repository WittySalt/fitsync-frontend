import { Routes } from '@angular/router';

/**
 * The Training pages under /progress/training (contract 5): the page itself, one activity and one
 * exercise, each loaded on demand. The parent route in app.routes.ts carries the auth guard.
 */
export const TRAINING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./training.page').then((module) => module.TrainingPage),
    title: 'FitSync Training'
  },
  {
    path: 'activities/:key',
    loadComponent: () => import('./activity/activity.page').then((module) => module.ActivityPage),
    title: 'FitSync Activity'
  },
  {
    path: 'exercises/:exerciseId',
    loadComponent: () => import('./exercise/exercise.page').then((module) => module.ExercisePage),
    title: 'FitSync Exercise'
  }
];

export default TRAINING_ROUTES;
