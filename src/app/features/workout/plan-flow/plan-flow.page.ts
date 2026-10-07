import { ChangeDetectionStrategy, Component, ElementRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SpotlightDirective } from '../../../core/guide/spotlight.directive';
import { ToastService } from '../../../core/toast/toast.service';
import { StatePanelComponent } from '../../../shared/state-panel.component';
import { DayEditorComponent } from './day-editor.component';
import { DraftMove } from './plan-draft';
import { PlanFlowStore } from './plan-flow.store';
import { ProfileCardComponent } from './profile-card.component';
import { ReviewStepComponent } from './review-step.component';
import { WeekPanelComponent } from './week-panel.component';
import { WeekStripComponent } from './week-strip.component';
import { observeBand } from './width-band';


/**
 * The plan flow: step 1 builds the week with the week itself as the navigation, step 2 reviews
 * and saves. One page for a new plan (`/workout/plans/new`) and for editing a saved one
 * (`/workout/plans/:id/edit`); the editor opens at step 1 with the plan loaded.
 */
@Component({
  selector: 'app-plan-flow-page',
  imports: [
    StatePanelComponent,
    ProfileCardComponent,
    WeekStripComponent,
    DayEditorComponent,
    WeekPanelComponent,
    ReviewStepComponent,
    SpotlightDirective
  ],
  providers: [PlanFlowStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-flow.page.html',
  styleUrl: './plan-flow.page.scss'
})
export class PlanFlowPage implements OnInit {
  protected readonly store = inject(PlanFlowStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly band = observeBand(inject(ElementRef));
  protected readonly discarding = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const planId = this.route.snapshot.paramMap.get('id');
    const template = this.route.snapshot.queryParamMap.get('template');
    this.store.start(planId, template);
  }

  protected cancel(): void {
    if (this.store.dirty()) {
      this.discarding.set(true);
      return;
    }
    this.leave();
  }

  protected leave(): void {
    void this.router.navigate(['/workout'], { queryParams: { tab: 'plans' } });
  }

  protected save(): void {
    this.store.save(() => {
      this.toast.success(this.store.editing() ? 'Plan updated.' : 'Plan saved.');
      this.leave();
    });
  }

  protected setMoves(moves: DraftMove[]): void {
    this.store.updateDay(this.store.selectedDay(), { moves });
  }
}
