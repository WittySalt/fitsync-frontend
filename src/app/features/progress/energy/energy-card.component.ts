import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { LOADING, Load } from '../../nutrition/diary/diary.models';
import { toIsoDate } from '../../nutrition/diary/diary-time';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { EnergyApiService } from './energy-api.service';
import { EnergyDaysComponent } from './energy-days.component';
import { EnergyTopComponent } from './energy-top.component';
import { EnergyWeeksComponent } from './energy-weeks.component';
import { EnergyWeek } from './energy.models';
import { shiftWeek, thisMonday, weekLabel } from './energy-figures';
import { MIN_LOGGED_DAYS } from './energy-mappers';

const FAILURE = 'Energy for this week could not load. Please retry.';

/**
 * Energy this week: what was eaten against what was used, for the week named in the switcher. The
 * top has the dial, the number and the two bars; below are the days behind one switch and the last
 * eight weeks. A week with no profile or too few logged days says so instead of showing a number.
 */
@Component({
  selector: 'app-energy-card',
  imports: [EnergyDaysComponent, EnergyTopComponent, EnergyWeeksComponent, RouterLink, StatePanelComponent],
  template: `
    <section class="card" aria-label="Energy this week">
      <header class="top">
        <div class="head">
          <span class="eyebrow">Energy this week</span>
          @if (label(); as text) {
            <span class="switcher">
              <button type="button" class="step" aria-label="Previous week" [disabled]="busy()" (click)="move(-1)">&lsaquo;</button>
              <strong>{{ text }}</strong>
              <button type="button" class="step" aria-label="Next week" [disabled]="!canGoNext()" (click)="move(1)">&rsaquo;</button>
            </span>
          }
        </div>
        @if (week(); as data) {
          @switch (kind()) {
            @case ('ok') {
              <app-energy-top [week]="data" />
            }
            @case ('no-profile') {
              <div class="message">
                <p>Add your height and weight to see what you use.</p>
                <a class="button secondary" routerLink="/me">Add in Me</a>
              </div>
            }
            @default {
              <p class="message">Log food on {{ minDays }} days this week to see the balance. {{ data.daysLogged }} so far.</p>
            }
          }
        } @else if (state().status === 'error') {
          <app-state-panel title="Energy unavailable" [message]="errorText()" actionLabel="Retry" [error]="true" (action)="retry()" />
        } @else {
          <div class="skeleton top-skeleton" aria-busy="true" aria-label="Loading energy for this week"></div>
        }
      </header>
      @if (week(); as data) {
        @if (kind() === 'ok' || kind() === 'few') {
          <div class="body">
            <app-energy-days [week]="data" />
            @if (kind() === 'ok' && data.weeks.length > 0) {
              <div class="weeks"><app-energy-weeks [weeks]="data.weeks" /></div>
            }
          </div>
        }
      } @else if (state().status === 'loading') {
        <div class="body"><div class="skeleton" aria-busy="true"></div></div>
      }
    </section>
  `,
  styleUrl: './energy-card.component.scss'
})
export class EnergyCardComponent implements OnInit {
  private readonly api = inject(EnergyApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly minDays = MIN_LOGGED_DAYS;
  protected readonly state = signal<Load<EnergyWeek>>(LOADING);
  protected readonly week = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly errorText = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.message : FAILURE;
  });
  /** The newest week that loaded. The switcher stays on it while another week is on its way. */
  private readonly shown = signal<EnergyWeek | null>(null);
  protected readonly label = computed(() => {
    const data = this.shown();
    return data ? weekLabel(data.weekStart, data.weekEnd) : '';
  });
  protected readonly busy = computed(() => this.state().status === 'loading');
  /** What the week can show: the full card, a prompt to add a profile, or a prompt to log more food. */
  protected readonly kind = computed<'ok' | 'no-profile' | 'few'>(() => {
    const data = this.week();
    if (data?.status === 'NO_PROFILE') {
      return 'no-profile';
    }
    return data?.status === 'OK' && (data.average?.balance ?? null) !== null ? 'ok' : 'few';
  });
  protected readonly canGoNext = computed(() => {
    const data = this.shown();
    return !!data && !this.busy() && data.weekStart < thisMonday(toIsoDate(new Date()));
  });

  private requested: string | undefined;
  private loading: Subscription | null = null;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.loading?.unsubscribe());
    this.load(undefined);
  }

  protected move(weeks: number): void {
    const current = this.shown();
    if (current && !this.busy() && (weeks < 0 || this.canGoNext())) {
      this.load(shiftWeek(current.weekStart, weeks));
    }
  }

  protected retry(): void {
    this.load(this.requested);
  }

  /** Loads a week by its Monday; with none given the server picks this week. */
  private load(weekStart: string | undefined): void {
    this.requested = weekStart;
    this.loading?.unsubscribe();
    this.state.set(LOADING);
    this.loading = this.api.getWeek(weekStart).subscribe({
      next: (data) => {
        this.shown.set(data);
        this.state.set({ status: 'ready', data });
      },
      error: () => this.state.set({ status: 'error', message: FAILURE })
    });
  }
}
