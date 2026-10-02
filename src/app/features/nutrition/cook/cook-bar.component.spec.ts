import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CookBarComponent } from './cook-bar.component';
import { COOK_SESSION_KEY, CookSessionService } from './cook-session.service';
import { CookTimerDef } from './cook.models';
import { pauseTimer, startStage } from './cook-timer';

const sides: CookTimerDef = { seconds: 180, maxSeconds: null, eachSide: true, phrase: '3 mins' };
const single: CookTimerDef = { seconds: 600, maxSeconds: null, eachSide: false, phrase: '10 minutes' };

describe('CookBarComponent', () => {
  let session: CookSessionService;

  function create() {
    const fixture = TestBed.createComponent(CookBarComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    sessionStorage.removeItem(COOK_SESSION_KEY);
    TestBed.configureTestingModule({ imports: [CookBarComponent], providers: [provideRouter([])] });
    session = TestBed.inject(CookSessionService);
  });

  afterEach(() => {
    session.clear();
    sessionStorage.removeItem(COOK_SESSION_KEY);
  });

  it('is not there without a session, while the page is open, or with no timer waiting', () => {
    const fixture = create();
    expect(fixture.nativeElement.querySelector('.bar')).toBeNull();
    session.open({ recipeId: 'r1', name: 'Salmon salad', servings: 2 }, [sides]);
    session.act(0, startStage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar')).toBeNull();
    session.leave(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar')).not.toBeNull();
    session.clear();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bar')).toBeNull();
  });

  it('shows the recipe name and the timers, soonest first, with +N for the rest', () => {
    const fixture = create();
    session.open({ recipeId: 'r1', name: 'Salmon salad', servings: 2 }, [single, sides, single]);
    session.act(0, startStage);
    session.act(1, startStage);
    session.act(2, (state, now) => pauseTimer(startStage(state, now), now));
    session.leave(true);
    session.tickNow();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.name')?.textContent).toBe('Salmon salad');
    const items = Array.from(el.querySelectorAll('.item')).map((n) => n.textContent);
    expect(items[0]).toMatch(/^First side [23]:\d\d$/);
    expect(items[1]).toMatch(/^Step 1 (9|10):\d\d$/);
    expect(items[2]).toBe('+1');
    expect(el.querySelector('.back')?.textContent).toContain('Back to cooking');
  });

  it('says it is time to turn when a first side is done', () => {
    const fixture = create();
    session.open({ recipeId: 'r1', name: 'Salmon salad', servings: 2 }, [sides]);
    session.act(0, startStage);
    session.leave(true);
    session.tickNow(Date.now() + 181_000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.item')?.textContent).toBe('Step 1: turn it');
  });

  it('goes back to the cook page of the recipe with its servings', () => {
    const fixture = create();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    session.open({ recipeId: 'r1', name: 'Salmon salad', servings: 2 }, [sides]);
    session.act(0, startStage);
    session.leave(true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.back') as HTMLElement).click();
    expect(navigate).toHaveBeenCalledWith(['/nutrition/recipes', 'r1', 'cook'], { queryParams: { servings: 2 } });
  });
});
