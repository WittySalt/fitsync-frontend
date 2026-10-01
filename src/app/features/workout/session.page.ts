import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { SessionDetailComponent } from './session-detail.component';
import { WorkoutLiveService } from './workout-live.service';

/**
 * One session of History on its own page, at /workout/sessions/:sessionId, so it can be opened,
 * reloaded and left with the browser's back button like any page. Back, a delete and a repeat all
 * return to the Workout page: History after the first two, Today with the exercise screen after a repeat.
 */
@Component({
  selector: 'app-session-page',
  imports: [SessionDetailComponent],
  template: `
    <section class="page">
      @if (sessionId(); as id) {
        <app-session-detail
          [sessionId]="id"
          (closed)="backToHistory()"
          (deleted)="deleted(id)"
          (repeated)="repeated()"
        />
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .page {
      max-width: 1000px;
      margin: 0 auto;
    }
  `
})
export class SessionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly live = inject(WorkoutLiveService);

  private readonly params = toSignal(this.route.paramMap.pipe(map((params) => params.get('sessionId'))), {
    initialValue: this.route.snapshot.paramMap.get('sessionId')
  });
  readonly sessionId = computed(() => this.params() || null);

  backToHistory(): void {
    void this.router.navigate(['/workout'], { queryParams: { tab: 'history' } });
  }

  deleted(sessionId: string): void {
    this.live.sessionRemoved(sessionId);
    this.backToHistory();
  }

  /** A repeated session is a new workout in progress, so the Workout page opens its exercise screen. */
  repeated(): void {
    this.live.open();
    void this.router.navigate(['/workout']);
  }
}
