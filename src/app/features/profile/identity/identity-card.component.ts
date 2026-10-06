import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Footprint } from '../../../core/me.models';
import { shortDate } from '../../../shared/coach/insight/slope-chart.geometry';
import { FootprintGridComponent } from '../footprint/footprint-grid.component';

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'FS';
  }
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
}

/** "Member since 4 Aug 2026 · Singapore"; either part is left out when it is not known. */
export function memberLine(since: string, place: string | null | undefined): string {
  const date = /^\d{4}-\d{2}-\d{2}/.test(since) ? `Member since ${shortDate(since.slice(0, 10))} ${since.slice(0, 4)}` : '';
  return [date, (place ?? '').trim()].filter(Boolean).join(' · ');
}

/**
 * The identity card, the one dark card on the Me page: who the person is, the footprint grid of the
 * whole membership, and the three lifetime numbers. When the footprint fails the error stays inside
 * this card and the rest of the page is unaffected.
 */
@Component({
  selector: 'app-identity-card',
  imports: [RouterLink, FootprintGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './identity-card.component.html',
  styleUrl: './identity-card.component.scss'
})
export class IdentityCardComponent {
  readonly name = input.required<string>();
  readonly avatarUrl = input<string | null>(null);
  readonly place = input<string | null>(null);
  /** The account's created date, used when the footprint does not say when the membership began. */
  readonly createdAt = input<string | null>(null);
  readonly footprint = input<Footprint | null>(null);
  readonly loading = input(false);
  readonly failed = input(false);
  /** Today as a date key in the person's zone. */
  readonly today = input.required<string>();
  readonly retry = output<void>();

  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly member = computed(() => memberLine(this.footprint()?.memberSince || this.createdAt() || '', this.place()));
  protected readonly totals = computed(() => this.footprint()?.totals ?? null);
  protected readonly started = computed(() => {
    const totals = this.totals();
    return !!totals && (totals.workouts > 0 || totals.daysLogged > 0);
  });
}
