import { Component, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';

import { ToastService } from '../../core/toast/toast.service';
import { WorkoutModalComponent } from './workout-modal.component';
import { WorkoutLiveService } from './workout-live.service';

/** The space the bar takes above the page's own padding, read by the shell and the coach button. */
const BAR_SPACE = 'calc(68px + env(safe-area-inset-bottom, 0px))';
const BAR_SPACE_PROPERTY = '--workout-bar-space';

/** How long the bar slides down before it is taken out. */
export const BAR_LEAVE_MS = 220;

/** What the bar shows of the workout; kept while it slides away, when the workout may be gone already. */
interface BarView {
  name: string;
  time: string;
  step: string;
  paused: boolean;
}

/**
 * The workout in progress, fixed above the bottom navigation on every page of the signed-in shell.
 * It shows while there is a workout and the exercise screen is not on screen. A tap anywhere but
 * "End" goes back to the workout. "End" asks what to do with it in a small dialog.
 */
@Component({
  selector: 'app-workout-bar',
  imports: [WorkoutModalComponent],
  templateUrl: './workout-bar.component.html',
  styleUrl: './workout-bar.component.scss'
})
export class WorkoutBarComponent implements OnDestroy {
  protected readonly live = inject(WorkoutLiveService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly visible = computed(() => !!this.live.active() && !this.live.screenOpen());
  /** The bar has just been put away and is sliding down. */
  protected readonly leaving = signal(false);
  protected readonly shown = computed(() => this.visible() || this.leaving());
  private readonly last = signal<BarView | null>(null);
  protected readonly view = computed<BarView | null>(() => {
    const session = this.live.active();
    return session
      ? { name: session.name, time: this.live.elapsedLabel(), step: this.live.currentLabel(), paused: this.live.paused() }
      : this.last();
  });
  protected readonly ending = signal(false);
  protected readonly confirmingDiscard = signal(false);
  protected readonly busy = signal(false);

  protected readonly accessibleName = computed(
    () => `Resume workout, ${this.live.active()?.name ?? 'workout'}, ${this.live.elapsedLabel()}`
  );

  private wasVisible = false;
  private leaveId: ReturnType<typeof setTimeout> | null = null;
  private readonly reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    effect(() => {
      const root = document.documentElement.style;
      if (this.visible()) {
        root.setProperty(BAR_SPACE_PROPERTY, BAR_SPACE);
      } else {
        root.removeProperty(BAR_SPACE_PROPERTY);
      }
    });

    // The bar slides up when it appears and down when it goes; it is kept for the slide.
    effect(() => {
      const visible = this.visible();
      const view = this.view();
      untracked(() => {
        if (visible) {
          this.clearLeave();
          this.leaving.set(false);
          this.last.set(view);
        } else if (this.wasVisible && !this.reducedMotion) {
          this.leaving.set(true);
          this.clearLeave();
          this.leaveId = setTimeout(() => this.leaving.set(false), BAR_LEAVE_MS);
        }
        this.wasVisible = visible;
      });
    });
  }

  ngOnDestroy(): void {
    this.clearLeave();
    document.documentElement.style.removeProperty(BAR_SPACE_PROPERTY);
  }

  private clearLeave(): void {
    if (this.leaveId) {
      clearTimeout(this.leaveId);
      this.leaveId = null;
    }
  }

  protected resume(): void {
    this.live.open();
    void this.router.navigateByUrl('/workout');
  }

  protected openEnd(): void {
    this.confirmingDiscard.set(false);
    this.ending.set(true);
  }

  protected keepGoing(): void {
    if (this.busy()) {
      return;
    }
    this.ending.set(false);
    this.confirmingDiscard.set(false);
  }

  protected finishAndSave(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.live.finishActive().subscribe({
      next: (session) => {
        if (session.status === 'CANCELLED') {
          if (!this.live.nothingLoggedCancel()) {
            this.toast.info('Workout was under 60 seconds, so it was cancelled and will not be saved.');
          }
        } else {
          this.toast.success('Workout completed.');
        }
        this.close();
      },
      error: () => {
        this.toast.error('Unable to finish workout. Please retry.');
        this.busy.set(false);
      }
    });
  }

  protected discard(): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.live.discardActive().subscribe({
      next: () => {
        this.toast.info('Workout cancelled.');
        this.close();
      },
      error: () => {
        this.toast.error('Unable to cancel workout. Please retry.');
        this.busy.set(false);
      }
    });
  }

  private close(): void {
    this.busy.set(false);
    this.ending.set(false);
    this.confirmingDiscard.set(false);
  }
}
