import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * The privacy notice. It is public: the route has no guard, and the app shell treats /privacy like the
 * sign-in pages, so it renders without the member navigation and without asking for a session.
 * The facts follow Documents/architecture/compliance-gdpr-pdpa.md; change both together.
 */
@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink],
  templateUrl: './privacy.page.html',
  styleUrl: './privacy.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacyPage {
  readonly lastUpdated = '9 October 2026';
  readonly contactEmail = 'privacy@fitsyncapp.click';

  /** The contents links scroll within the page; the router has no anchor scrolling switched on. */
  jump(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
