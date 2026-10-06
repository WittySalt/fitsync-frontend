import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { FitSyncDataService } from '../../../core/fitsync-data.service';
import { Goal } from '../../../core/fitsync.models';
import { signInAs } from '../../../core/guide/guide-testing.spec';
import { GuideCardComponent } from './guide-card.component';

const goal = (goalType: string): Goal => ({ goalType, status: 'ACTIVE' }) as Goal;

describe('GuideCardComponent', () => {
  let fixture: ComponentFixture<GuideCardComponent>;

  function render(done: { goals?: Goal[]; plan?: boolean; meal?: boolean; session?: boolean }): HTMLElement {
    const data = jasmine.createSpyObj<FitSyncDataService>('FitSyncDataService', ['getWorkoutPlans', 'getWorkoutSessionPage', 'hasLoggedMeal']);
    data.getWorkoutPlans.and.returnValue(of(done.plan ? [{ status: 'ACTIVE' } as never] : []));
    data.getWorkoutSessionPage.and.returnValue(of({ sessions: done.session ? [{}] : [] }) as never);
    data.hasLoggedMeal.and.returnValue(of(!!done.meal));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: FitSyncDataService, useValue: data }
      ]
    });
    signInAs('card-user');
    fixture = TestBed.createComponent(GuideCardComponent);
    fixture.componentRef.setInput('goals', done.goals ?? []);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('shows four numbered steps with the first undone one highlighted when nothing is done', () => {
    const el = render({});

    expect(el.querySelector('.eyebrow')?.textContent).toContain('Getting started');
    expect(el.querySelector('h2')?.textContent).toContain('Four steps to your first week');
    const tiles = el.querySelectorAll('.tile');
    expect(tiles.length).toBe(4);
    expect(Array.from(tiles).map((tile) => tile.querySelector('.disc')?.textContent?.trim())).toEqual(['1', '2', '3', '4']);
    expect(tiles[0].classList).toContain('current');
    expect(el.querySelectorAll('.go.primary').length).toBe(1);
    const links = Array.from(el.querySelectorAll('a.go')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/me#goal-lifecycle', '/workout/plans/new', '/nutrition?log=BREAKFAST', '/workout']);
  });

  it('marks finished steps with a check, drops their button and moves the highlight on', () => {
    const el = render({ goals: [goal('WEIGHT')], plan: true });

    const tiles = el.querySelectorAll('.tile');
    expect(tiles[0].classList).toContain('done');
    expect(tiles[1].classList).toContain('done');
    expect(tiles[0].querySelector('.go')).toBeNull();
    expect(tiles[0].querySelector('.disc')?.classList).toContain('filled');
    expect(tiles[2].classList).toContain('current');
    expect(el.querySelectorAll('a.go').length).toBe(2);
  });

  it('keeps the card at three of four done', () => {
    const el = render({ goals: [goal('WEIGHT')], plan: true, meal: true });

    expect(el.querySelectorAll('.tile.done').length).toBe(3);
    expect(el.querySelector('.tile.current')?.getAttribute('data-step')).toBe('session');
  });

  it('folds to one line when all four are done', () => {
    const el = render({ goals: [goal('WORKOUT_FREQUENCY')], plan: true, meal: true, session: true });

    expect(el.querySelector('.tiles')).toBeNull();
    expect(el.querySelector('.folded-line')?.textContent).toContain("You're set up. The coach takes it from here.");
    expect(el.querySelector('.hide')).not.toBeNull();
  });

  it('is hidden by Hide and stays hidden on the next visit', () => {
    const el = render({});
    (el.querySelector('.hide') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('section')).toBeNull();

    TestBed.resetTestingModule();
    const again = render({});
    expect(again.querySelector('section')).toBeNull();
  });
});
