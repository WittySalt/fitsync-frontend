import { Routes } from '@angular/router';

/**
 * STUB. The Training pages (boards 18a, 17b, 17c) are built in the sibling worktree
 * frontend-prog-training, which replaces this file. Until then each address shows the shared
 * "coming soon" page, so the links from Progress lead somewhere.
 */
const soon = () => import('../../../shared/pages/placeholder.page').then((module) => module.PlaceholderPage);

export const TRAINING_ROUTES: Routes = [
  { path: '', loadComponent: soon, data: { placeholder: 'soon' }, title: 'FitSync Training' },
  { path: 'activities/:key', loadComponent: soon, data: { placeholder: 'soon' }, title: 'FitSync Activity' },
  { path: 'exercises/:exerciseId', loadComponent: soon, data: { placeholder: 'soon' }, title: 'FitSync Exercise' }
];

export default TRAINING_ROUTES;
