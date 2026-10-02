import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CookContinueComponent } from './cook-continue.component';
import { COOK_SESSION_KEY, CookSessionService } from './cook-session.service';
import { CookTimerDef } from './cook.models';
import { startStage } from './cook-timer';

const sides: CookTimerDef = { seconds: 180, maxSeconds: null, eachSide: true, phrase: '3 mins' };
const meta = { recipeId: 'r1', name: 'Salmon salad', servings: 2 };

describe('CookContinueComponent', () => {
  let session: CookSessionService;

  function create() {
    const fixture = TestBed.createComponent(CookContinueComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    sessionStorage.removeItem(COOK_SESSION_KEY);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(CookSessionService);
  });

  afterEach(() => {
    session.clear();
    sessionStorage.removeItem(COOK_SESSION_KEY);
  });

  it('is not there without a session, while cook mode is open, or before any progress', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('');
    session.open(meta, [null, sides]);
    session.goTo(1);
    fixture.detectChanges();
    expect(el.textContent?.trim()).toBe('');
    session.leave(true);
    session.open(meta, [null, sides]);
    session.leave(true);
    session.clear();
    session.open({ ...meta, recipeId: 'r2' }, [null, sides]);
    session.leave(true);
    fixture.detectChanges();
    expect(el.textContent?.trim()).toBe('');
  });

  it('shows the recipe, the step and the timer that ends first', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    session.open(meta, [null, sides, null]);
    session.goTo(1);
    session.act(1, startStage);
    session.goTo(2);
    session.leave(true);
    session.tickNow();
    fixture.detectChanges();
    expect(el.querySelector('.kicker')?.textContent).toBe('Continue cooking');
    expect(el.querySelector('.name')?.textContent).toBe('Salmon salad');
    expect(el.querySelector('.meta')?.textContent).toMatch(/^Step 3 of 3 · First side [23]:\d\d left$/);
    expect(el.querySelector('.resume')?.textContent).toContain('Back to cooking');
  });

  it('shows the step alone with no timer running, and names a timer the cook added', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    session.open(meta, [null, null]);
    session.goTo(1);
    session.leave(true);
    fixture.detectChanges();
    expect(el.querySelector('.meta')?.textContent).toBe('Step 2 of 2');
    session.addCustom(1, 'Rice', 12);
    fixture.detectChanges();
    expect(el.querySelector('.meta')?.textContent).toMatch(/^Step 2 of 2 · Rice 1[12]:\d\d left$/);
  });

  it('goes back to cook mode of the recipe with its servings, and Stop cooking ends the session', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    session.open(meta, [null, null]);
    session.goTo(1);
    session.leave(true);
    fixture.detectChanges();
    (el.querySelector('.resume') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/nutrition/recipes', 'r1', 'cook'], { queryParams: { servings: 2 } });
    (el.querySelector('.stop') as HTMLElement).click();
    fixture.detectChanges();
    expect(session.data()).toBeNull();
    expect(el.textContent?.trim()).toBe('');
  });
});
