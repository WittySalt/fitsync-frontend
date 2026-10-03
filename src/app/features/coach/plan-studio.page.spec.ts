import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { CoachApiService } from '../../core/coach/coach-api.service';
import { SessionDraftView } from '../../core/coach/coach.models';
import { CoachStore } from '../../core/coach/coach.store';
import { ToastService } from '../../core/toast/toast.service';
import { PlanStudioPage } from './plan-studio.page';

const draft: SessionDraftView = {
  artifactId: 'a1',
  status: 'DRAFT',
  source: 'MODEL_REPAIRED',
  validationAttempts: 2,
  session: {
    title: 'Upper body push',
    focus: ['CHEST', 'SHOULDERS'],
    estimatedMinutes: 42,
    exercises: [
      { exerciseId: 'e1', name: 'Barbell Bench Press', sets: 4, reps: 8, seconds: null, restSeconds: 90, rationale: 'Main press.' },
      { exerciseId: 'e2', name: 'Plank Hold', sets: 3, reps: null, seconds: 45, restSeconds: 45, rationale: 'Bracing.' }
    ],
    summary: 'Because you have not pressed this week.'
  },
  planId: null,
  sessionId: null,
  rejectionReason: null
};

describe('PlanStudioPage', () => {
  let fixture: ComponentFixture<PlanStudioPage>;
  let api: jasmine.SpyObj<CoachApiService>;
  let toast: jasmine.SpyObj<ToastService>;
  let router: Router;

  function setup(queryDraft: string | null): void {
    api = jasmine.createSpyObj<CoachApiService>('CoachApiService', [
      'listRecommendations',
      'refreshRecommendations',
      'listSessionDrafts',
      'getSessionDraft',
      'draftSession',
      'acceptSessionDraft',
      'rejectSessionDraft'
    ]);
    api.listRecommendations.and.returnValue(of([]));
    api.refreshRecommendations.and.returnValue(of(undefined));
    api.listSessionDrafts.and.returnValue(of([draft]));
    api.getSessionDraft.and.returnValue(of(draft));
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'info', 'error']);

    TestBed.configureTestingModule({
      imports: [PlanStudioPage],
      providers: [
        provideRouter([]),
        { provide: CoachApiService, useValue: api },
        { provide: ToastService, useValue: toast },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryDraft ? { draft: queryDraft } : {}) } } }
      ]
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PlanStudioPage);
    fixture.detectChanges();
  }

  it('lists the drafts and opens the one named in the URL', () => {
    setup('a1');

    expect(api.listSessionDrafts).toHaveBeenCalled();
    expect(fixture.componentInstance.selected()?.artifactId).toBe('a1');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Upper body push');
    expect(text).toContain('Barbell Bench Press');
    expect(text).toContain('4 × 8 · 90s rest');
    expect(text).toContain('3 × 45s · 45s rest');
  });

  it('says how the draft was produced, in words, and shows the correction when there was one', () => {
    setup('a1');

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('corrected once by the validator');
    expect(text).toContain('corrected once: the first attempt broke a rule');
    expect(text).toContain('avoids what you trained yesterday');
  });

  it('does not claim the yesterday rule for a draft the rules built, and keeps the rest', () => {
    setup('a1');
    const labels = fixture.componentInstance.checks({ ...draft, source: 'RULE_FALLBACK' }).map((c) => c.label);

    expect(labels).not.toContain('avoids what you trained yesterday');
    expect(labels).toContain('every exercise is a real catalogue row');
    expect(labels).not.toContain('corrected once: the first attempt broke a rule');
  });

  it('shows the findings the draft carries instead of the stock list', () => {
    setup('a1');
    const checks = fixture.componentInstance.checks({
      ...draft,
      findings: [
        { label: 'Bench Press fits your barbell', passed: true },
        { label: 'Swapped a leg exercise worked yesterday', passed: false }
      ]
    });

    expect(checks).toEqual([
      { label: 'Bench Press fits your barbell', note: false },
      { label: 'Swapped a leg exercise worked yesterday', note: true }
    ]);
  });

  it('asks for a reason first, prefilled, and sets the draft aside only on the confirm', () => {
    setup('a1');
    api.rejectSessionDraft.and.returnValue(of({ ...draft, status: 'DISCARDED', rejectionReason: 'Too long' }));
    const root = fixture.nativeElement as HTMLElement;
    const notForMe = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('Not for me')) as HTMLButtonElement;

    notForMe.click();
    fixture.detectChanges();

    expect(api.rejectSessionDraft).not.toHaveBeenCalled();
    const input = root.querySelector('#reject-reason') as HTMLInputElement;
    expect(input.value).toBe('Not for me today');
    expect(root.querySelectorAll('.button.danger').length).toBe(1);

    input.value = 'Too long';
    input.dispatchEvent(new Event('input'));
    (root.querySelector('.button.danger') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.rejectSessionDraft).toHaveBeenCalledWith('a1', 'Too long');
    expect(fixture.componentInstance.selected()?.status).toBe('DISCARDED');
    expect(fixture.componentInstance.rejecting()).toBeFalse();
  });

  it('falls back to the default reason when it was cleared, and Keep it closes the form', () => {
    setup('a1');
    api.rejectSessionDraft.and.returnValue(of({ ...draft, status: 'DISCARDED' }));
    const page = fixture.componentInstance;

    page.startReject();
    page.cancelReject();
    expect(page.rejecting()).toBeFalse();
    expect(api.rejectSessionDraft).not.toHaveBeenCalled();

    page.startReject();
    page.reason.set('   ');
    page.reject(draft);
    expect(api.rejectSessionDraft).toHaveBeenCalledWith('a1', 'Not for me today');
  });

  it('clears the dock draft card after accepting', () => {
    setup('a1');
    const store = TestBed.inject(CoachStore);
    store.latestDraft.set(draft);
    api.acceptSessionDraft.and.returnValue(
      of({ artifactId: 'a1', status: 'ACCEPTED', planId: 'p1', sessionId: 's1', sessionStarted: true })
    );

    fixture.componentInstance.accept(draft);

    expect(store.latestDraft()).toBeNull();
  });

  it('accepting starts the session, says so, and goes to the Workout page', () => {
    setup('a1');
    api.acceptSessionDraft.and.returnValue(
      of({ artifactId: 'a1', status: 'ACCEPTED', planId: 'p1', sessionId: 's1', sessionStarted: true })
    );

    fixture.componentInstance.accept(draft);

    expect(api.acceptSessionDraft).toHaveBeenCalledWith('a1');
    expect(toast.success).toHaveBeenCalledWith('Session started: Upper body push');
    expect(router.navigate).toHaveBeenCalledWith(['/workout'], { queryParams: { tab: 'history', status: 'IN_PROGRESS' } });
    expect(fixture.componentInstance.selected()?.status).toBe('ACCEPTED');
  });

  it('when the plan saved but the session did not start, says that rather than pretending', () => {
    setup('a1');
    api.acceptSessionDraft.and.returnValue(
      of({ artifactId: 'a1', status: 'ACCEPTED', planId: 'p1', sessionId: null, sessionStarted: false })
    );

    fixture.componentInstance.accept(draft);

    expect(toast.info).toHaveBeenCalledWith(jasmine.stringContaining('could not be started'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('keeps the draft and shows the reason when accepting fails', () => {
    setup('a1');
    api.acceptSessionDraft.and.returnValue(
      throwError(() => ({ status: 409, error: { message: 'This draft was rejected and cannot be accepted.' } }))
    );

    fixture.componentInstance.accept(draft);

    expect(fixture.componentInstance.error()).toContain('cannot be accepted');
    expect(fixture.componentInstance.selected()?.status).toBe('DRAFT');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("shows the server's reason when nothing could be built", () => {
    setup(null);
    api.draftSession.and.returnValue(
      throwError(() => ({ status: 503, error: { message: 'Everything available trains a muscle group worked yesterday.' } }))
    );

    fixture.componentInstance.build();

    expect(fixture.componentInstance.error()).toContain('worked yesterday');
    expect(fixture.componentInstance.building()).toBeFalse();
  });

  it('building selects the new draft and adds it to the list', () => {
    setup(null);
    const built = { ...draft, artifactId: 'a2', source: 'MODEL' as const, validationAttempts: 1 };
    api.draftSession.and.returnValue(of(built));

    fixture.componentInstance.request.set('shoulders');
    fixture.componentInstance.build();

    expect(api.draftSession).toHaveBeenCalledWith('shoulders');
    expect(fixture.componentInstance.selected()?.artifactId).toBe('a2');
    expect(TestBed.inject(CoachStore).drafts().map((d) => d.artifactId)).toEqual(['a2', 'a1']);
  });
});
