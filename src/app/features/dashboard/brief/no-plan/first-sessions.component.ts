import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FitSyncDataService } from '../../../../core/fitsync-data.service';
import { DayKind, WorkoutPlan } from '../../../../core/fitsync.models';
import { ToastService } from '../../../../core/toast/toast.service';
import { DAY_KIND_GLYPHS } from '../day-kind-icons';
import { GlyphShape } from '../muscle-icons';
import {
  FIRST_SESSION_TEMPLATES,
  FirstSessionAnswers,
  StarterTemplate,
  answersFromSeed,
  difficultyLabel,
  hasAnswers,
  movesLabel,
  pickFirstSessions,
  templateKind
} from './first-sessions';
import { NoTemplateExercisesError, PlanTemplateActivationService } from './plan-template-activation.service';

/** The three first sessions offered to a person who has no plan yet. */
@Component({
  selector: 'app-first-sessions',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './first-sessions.component.html',
  styleUrl: './first-sessions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FirstSessionsComponent implements OnInit {
  private readonly dataService = inject(FitSyncDataService);
  private readonly activation = inject(PlanTemplateActivationService);
  private readonly toast = inject(ToastService);
  private readonly templates = inject(FIRST_SESSION_TEMPLATES);

  /** Emits the plan once it is created and active, so the brief can load what the plan changes. */
  readonly planStarted = output<WorkoutPlan>();

  // The answers arrive on their own request. The cards wait for it, so that they are drawn once,
  // in their final order, instead of shuffling when the answers land.
  readonly answers = signal<FirstSessionAnswers | null>(null);
  readonly ready = signal(false);
  readonly startingId = signal<string | null>(null);
  // Once a plan is active the cards stay disabled until the brief replaces them, so that a second
  // press cannot create a second plan in the gap while the brief reloads.
  readonly started = signal(false);

  readonly personalised = computed(() => hasAnswers(this.answers()));
  readonly options = computed(() =>
    pickFirstSessions(this.templates, this.answers()).map((template) => ({
      template,
      glyph: this.glyphFor(templateKind(template)),
      meta: movesLabel(template),
      difficulty: difficultyLabel(template.difficulty)
    }))
  );

  ngOnInit(): void {
    // The answers are a soft dependency: without them the first three templates are offered as listed.
    this.dataService.getOnboardingSeed().subscribe({
      next: (seed) => {
        this.answers.set(answersFromSeed(seed.value));
        this.ready.set(true);
      },
      error: () => this.ready.set(true)
    });
  }

  start(template: StarterTemplate): void {
    if (this.startingId() || this.started()) {
      return;
    }
    this.startingId.set(template.id);
    this.activation.activate(template).subscribe({
      next: ({ plan, skipped }) => {
        this.startingId.set(null);
        this.started.set(true);
        this.toast.success('Plan started.');
        if (skipped > 0) {
          this.toast.info(`${skipped} template exercise${skipped === 1 ? '' : 's'} unavailable and skipped.`);
        }
        this.planStarted.emit(plan);
      },
      error: (error: unknown) => {
        this.startingId.set(null);
        this.toast.error(
          error instanceof NoTemplateExercisesError ? error.message : 'Unable to start this plan. Please retry.'
        );
      }
    });
  }

  private glyphFor(kind: DayKind): GlyphShape[] {
    return DAY_KIND_GLYPHS[kind];
  }
}
