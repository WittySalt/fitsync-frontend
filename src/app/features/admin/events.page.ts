import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { AdminAction, isForbidden } from './admin-action';
import { AdminActionStatusComponent } from './admin-action-status.component';
import { AdminApiService, OutboxPending, OutboxService } from './admin-api.service';
import { AdminConfirmButtonComponent } from './admin-confirm-button.component';
import { formatLocalDateTime, relativeAge } from './admin-format';

type RowState = { kind: 'loading' } | { kind: 'ready'; outbox: OutboxPending } | { kind: 'error'; forbidden: boolean };

interface ServiceRow {
  service: OutboxService;
  name: string;
  publish: AdminAction;
}

interface RowView {
  service: OutboxService;
  name: string;
  state: RowState['kind'];
  waiting: number;
  oldest: string;
  oldestTitle: string | null;
  publish: AdminAction;
}

export const NO_EVENTS_WAITING = 'None';

/** What the Oldest column shows: a relative age, or "None" when nothing waits or the instant cannot be read. */
export function oldestLabel(outbox: OutboxPending, now: Date): string {
  if (outbox.pending <= 0 || outbox.oldestCreatedAt === null) {
    return NO_EVENTS_WAITING;
  }
  return relativeAge(outbox.oldestCreatedAt, now) ?? NO_EVENTS_WAITING;
}

@Component({
  selector: 'app-admin-events-page',
  imports: [AdminConfirmButtonComponent, AdminActionStatusComponent],
  templateUrl: './events.page.html',
  styleUrls: ['./admin-page.scss', './events.page.scss']
})
export class EventsPage {
  private readonly api = inject(AdminApiService);
  private readonly loads = new Map<OutboxService, Subscription>();

  protected readonly services: ServiceRow[] = [
    { service: 'auth', name: 'Accounts', publish: new AdminAction() },
    { service: 'users', name: 'Profiles and goals', publish: new AdminAction() },
    { service: 'workouts', name: 'Workouts', publish: new AdminAction() },
    { service: 'nutrition', name: 'Nutrition', publish: new AdminAction() }
  ];

  private readonly states = signal<Record<OutboxService, RowState>>({
    auth: { kind: 'loading' },
    users: { kind: 'loading' },
    workouts: { kind: 'loading' },
    nutrition: { kind: 'loading' }
  });
  // Read when a row arrives, because a computed value must not read the clock itself.
  private readonly loadedAt = signal(new Date());

  protected readonly rows = computed<RowView[]>(() => {
    const states = this.states();
    const now = this.loadedAt();
    return this.services.map((row) => {
      const state = states[row.service];
      const outbox = state.kind === 'ready' ? state.outbox : null;
      const oldest = outbox ? oldestLabel(outbox, now) : NO_EVENTS_WAITING;
      return {
        service: row.service,
        name: row.name,
        state: state.kind,
        waiting: outbox?.pending ?? 0,
        oldest,
        oldestTitle: outbox && oldest !== NO_EVENTS_WAITING && outbox.oldestCreatedAt ? formatLocalDateTime(outbox.oldestCreatedAt) : null,
        publish: row.publish
      };
    });
  });

  // A member is refused on every row, so one refusal is enough to replace the table.
  protected readonly forbidden = computed(() => Object.values(this.states()).some((state) => state.kind === 'error' && state.forbidden));
  protected readonly loading = computed(() => Object.values(this.states()).some((state) => state.kind === 'loading'));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.loads.forEach((subscription) => subscription.unsubscribe()));
    this.refresh();
  }

  protected refresh(): void {
    this.services.forEach((row) => this.load(row.service));
  }

  protected retry(service: OutboxService): void {
    this.load(service);
  }

  protected publish(row: RowView): void {
    row.publish.run(
      () => this.api.publishOutbox(row.service),
      (result) => `Published ${result.publishedCount}.`,
      () => this.load(row.service)
    );
  }

  // A row that already shows numbers keeps them while it reloads, so only a first read or a retry shows the loading bars.
  private load(service: OutboxService): void {
    this.loads.get(service)?.unsubscribe();
    if (this.states()[service].kind !== 'ready') {
      this.setState(service, { kind: 'loading' });
    }
    this.loads.set(
      service,
      this.api.getOutboxPending(service).subscribe({
        next: (outbox) => {
          this.loadedAt.set(new Date());
          this.setState(service, { kind: 'ready', outbox });
        },
        error: (error: unknown) => this.setState(service, { kind: 'error', forbidden: isForbidden(error) })
      })
    );
  }

  private setState(service: OutboxService, state: RowState): void {
    this.states.update((current) => ({ ...current, [service]: state }));
  }
}
