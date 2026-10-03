import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * STUB. The Training card (board 18c) is built in the sibling worktree frontend-prog-training; this
 * placeholder only keeps the Progress page building until that work lands and replaces this file.
 */
@Component({
  selector: 'app-training-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <h2>Training</h2>
      <a routerLink="/progress/training">Open Training ›</a>
    </article>
  `,
  styles: `
    .card { display: flex; align-items: center; justify-content: space-between; padding: 22px; border-radius: 22px; background: var(--surface); border: 1px solid var(--border); }
    h2 { margin: 0; font-size: 17px; }
    a { font-size: 13px; font-weight: 700; color: var(--accent-text); text-decoration: none; }
  `
})
export class TrainingCardComponent {}
