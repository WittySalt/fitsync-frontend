import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/** Stands in for an admin page that is not built yet. It shows no data. */
@Component({
  selector: 'app-admin-placeholder-page',
  template: `
    <h1>{{ heading }}</h1>
    <p>This page is being built.</p>
  `,
  styles: `
    :host {
      display: block;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 36px;
      font-weight: var(--fw-semibold);
      line-height: 1.1;
      letter-spacing: -0.01em;
    }

    p {
      margin: 0;
      font-size: 15px;
      color: var(--text-secondary);
    }

    @media (max-width: 640px) {
      h1 {
        font-size: 28px;
      }
    }
  `
})
export class AdminPlaceholderPage {
  protected readonly heading = String(inject(ActivatedRoute).snapshot.data['heading'] ?? 'Admin');
}
