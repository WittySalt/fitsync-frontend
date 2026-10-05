import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, map } from 'rxjs';

import { StatePanelComponent } from '../../../shared/state-panel.component';
import { ProgressBack } from '../../progress/cards/progress-back';
import { LOADING, Load } from '../diary/diary.models';
import { UserTimezoneService } from '../../../core/user-timezone.service';
import { NutrientDetail, NutrientTileData, NutrientsOverview, PeriodKey } from './nutrients.models';
import { NutrientsService } from './nutrients.service';
import { PERIODS, parsePeriod, periodRange, reachSummary } from './nutrients-figures';
import { saveScroll, takeScroll } from './nutrients-scroll';
import { NutrientHeroComponent } from './nutrient-hero.component';
import { NutrientSidePanelComponent } from './nutrient-side-panel.component';
import { NutrientTableComponent } from './nutrient-table.component';

/** Wide enough for the side panel beside the table. Below it a tile opens the nutrient page. */
export const WIDE_FROM = 760;

const FAILURE = 'Your nutrients could not load. Please retry.';

/**
 * All nutrients: the petal chart over the periodic table of vitamins and minerals for Today, 7 days
 * or 30 days. The period lives in the URL. On a wide screen a tile fills the side panel and on a
 * phone it opens the nutrient page.
 */
@Component({
  selector: 'app-nutrients-page',
  imports: [NutrientHeroComponent, NutrientSidePanelComponent, NutrientTableComponent, RouterLink, StatePanelComponent],
  template: `
    <div class="page-grid nutrients-page">
      <a class="back" routerLink="/nutrition" aria-label="Back" (click)="goBack($event)">&lsaquo; Back</a>
      <header class="head">
        <div class="title">
          <h1>All nutrients</h1>
          @if (overview(); as data) {
            <span class="sub">
              {{ data.daysLogged }} of {{ range().days }} days logged
              @if (data.referenceLabel) {
                &middot; {{ data.referenceLabel }}
              }
              &middot; <a routerLink="/settings" [queryParams]="{ section: 'preferences' }">Change</a>
            </span>
          }
        </div>
        <div class="segmented periods" role="group" aria-label="Period">
          @for (option of periods; track option.key) {
            <button type="button" [class.active]="period() === option.key" [attr.aria-pressed]="period() === option.key" (click)="setPeriod(option.key)">
              {{ option.label }}
            </button>
          }
        </div>
      </header>

      @if (state().status === 'loading') {
        <div class="skeleton hero" aria-busy="true" aria-label="Loading your nutrients"></div>
        <div class="skeleton tall" aria-busy="true"></div>
      } @else if (state().status === 'error') {
        <app-state-panel title="Nutrients unavailable" [message]="errorMessage()" actionLabel="Retry" [error]="true" (action)="retry()" />
      } @else if (overview(); as data) {
        @if (data.nutrients.length === 0) {
          <app-state-panel title="No nutrients yet" message="There are no vitamin or mineral figures for this period." />
        } @else {
          <app-nutrient-hero [nutrients]="data.nutrients" [period]="period()" (open)="open($event)" />
          <div class="layout" [class.with-panel]="wide() && selectedNutrient()">
            <app-nutrient-table [nutrients]="data.nutrients" [selected]="wide() ? selected() : null" (pick)="pick($event)" />
            @if (wide() && selectedNutrient(); as picked) {
              <app-nutrient-side-panel [nutrient]="picked" [detail]="detailOf(picked.code)" [period]="period()" />
            }
          </div>
        }
      }
    </div>
  `,
  styleUrl: './nutrients.page.scss'
})
export class NutrientsPage {
  private readonly service = inject(NutrientsService);
  private readonly progressBack = inject(ProgressBack);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly userTimezone = inject(UserTimezoneService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Steps back to wherever the person came from, else opens Nutrition. */
  protected goBack(event: Event): void {
    event.preventDefault();
    this.progressBack.back('/nutrition');
  }

  protected readonly periods = PERIODS;
  protected readonly period = toSignal(this.route.queryParamMap.pipe(map((params) => parsePeriod(params.get('period')))), {
    initialValue: parsePeriod(this.route.snapshot.queryParamMap.get('period'))
  });
  protected readonly range = computed(() => periodRange(this.period(), this.userTimezone.dateKey()));

  protected readonly state = signal<Load<NutrientsOverview>>(LOADING);
  protected readonly overview = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly errorMessage = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state.message : FAILURE;
  });

  protected readonly wide = signal(true);
  protected readonly selected = signal<string | null>(null);
  protected readonly selectedNutrient = computed(() => {
    const data = this.overview();
    const code = this.selected();
    return data?.nutrients.find((item) => item.code === code) ?? null;
  });

  private readonly details = signal<Record<string, Load<NutrientDetail>>>({});
  private loading: Subscription | null = null;
  private restored = false;

  constructor() {
    effect(() => {
      const period = this.period();
      untracked(() => this.load(period));
    });
    effect(() => {
      // On a wide screen the panel is never empty: it starts on the nutrient furthest short.
      const data = this.overview();
      if (data && this.wide() && !this.selectedNutrient()) {
        const first = reachSummary(data.nutrients).lowest[0] ?? data.nutrients[0];
        untracked(() => this.select(first));
      }
    });
    afterNextRender(() => this.watchWidth());
    this.destroyRef.onDestroy(() => {
      this.loading?.unsubscribe();
      saveScroll(this.period(), window.scrollY);
    });
  }

  protected setPeriod(key: PeriodKey): void {
    if (key !== this.period()) {
      void this.router.navigate([], { relativeTo: this.route, queryParams: { period: key }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  protected retry(): void {
    this.load(this.period());
  }

  protected pick(item: NutrientTileData): void {
    if (this.wide()) {
      this.select(item);
    } else {
      this.open(item);
    }
  }

  protected open(item: NutrientTileData): void {
    void this.router.navigate(['/nutrition/nutrients', item.code], { queryParams: { period: this.period() } });
  }

  protected detailOf(code: string): Load<NutrientDetail> {
    return this.details()[this.detailKey(code)] ?? LOADING;
  }

  private select(item: NutrientTileData | undefined): void {
    if (!item) {
      return;
    }
    this.selected.set(item.code);
    this.loadDetail(item.code);
  }

  private load(period: PeriodKey): void {
    this.loading?.unsubscribe();
    this.state.set(LOADING);
    this.details.set({});
    const { from, to } = periodRange(period, this.userTimezone.dateKey());
    this.loading = this.service.getAll(from, to).subscribe({
      next: (data) => {
        this.state.set({ status: 'ready', data });
        this.restoreScroll(period);
      },
      error: () => this.state.set({ status: 'error', message: FAILURE })
    });
  }

  private loadDetail(code: string): void {
    const key = this.detailKey(code);
    if (this.details()[key]) {
      return;
    }
    const { from, to } = this.range();
    this.details.update((all) => ({ ...all, [key]: LOADING }));
    this.service.getOne(code, from, to).subscribe({
      next: (data) => this.details.update((all) => ({ ...all, [key]: { status: 'ready', data } })),
      error: () => this.details.update((all) => ({ ...all, [key]: { status: 'error', message: 'The foods could not load.' } }))
    });
  }

  private detailKey(code: string): string {
    return `${this.period()}:${code}`;
  }

  private restoreScroll(period: PeriodKey): void {
    if (this.restored) {
      return;
    }
    this.restored = true;
    const y = takeScroll(period);
    if (y !== null) {
      setTimeout(() => window.scrollTo({ top: y }), 0);
    }
  }

  private watchWidth(): void {
    const element = this.host.nativeElement;
    const measure = (): void => this.wide.set(element.clientWidth >= WIDE_FROM);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
