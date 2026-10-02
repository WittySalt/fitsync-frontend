import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';

import { CookPage } from './cook.page';
import { COOK_SESSION_KEY, CookSessionService } from './cook-session.service';

const URL = '/api/v1/nutrition/recipes/r1';

function wire(overrides: Record<string, unknown> = {}, plain = false): Record<string, unknown> {
  const ids = (list: string[]) => (plain ? {} : { ingredientIds: list });
  return {
    id: 'r1',
    name: 'Salmon salad',
    servings: 2,
    imageUrl: null,
    ingredients: [
      { ingredientId: 'i1', foodName: 'Salmon', displayText: '200 g salmon', grams: 200, foodGroup: 'PROTEIN', categoryCode: 'SEAFOOD' },
      { ingredientId: 'i2', foodName: 'Olive oil', displayText: 'oil', grams: 20, foodGroup: 'NUTS', categoryCode: 'FATS_OILS' },
      { ingredientId: 'i3', foodName: 'Lime', displayText: 'lime', grams: 10, foodGroup: 'FRUIT', categoryCode: 'FRUITS' }
    ],
    steps: [
      { stepNumber: 1, text: 'Mix the lime and the oil.', title: 'Mix the dressing', ...ids(['i3', 'i2']) },
      {
        stepNumber: 2,
        text: 'Fry the salmon for 3-4 mins on each side.',
        title: 'Fry the salmon',
        ...ids(['i1']),
        timers: [{ seconds: 180, maxSeconds: 240, eachSide: true, phrase: '3-4 mins' }]
      },
      {
        stepNumber: 3,
        text: 'Rest for 5 minutes, then serve.',
        title: 'Rest and serve',
        timers: [{ seconds: 300, maxSeconds: null, eachSide: false, phrase: '5 minutes' }]
      }
    ],
    ...overrides
  };
}

describe('CookPage', () => {
  let fixture: ComponentFixture<CookPage>;
  let http: HttpTestingController;
  let session: CookSessionService;
  let el: HTMLElement;

  function setup(servings = '2'): void {
    TestBed.configureTestingModule({
      imports: [CookPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'r1' }), queryParamMap: convertToParamMap({ servings }) } }
        }
      ]
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(CookSessionService);
    fixture = TestBed.createComponent(CookPage);
    el = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function load(body: Record<string, unknown> = wire()): void {
    http.expectOne(URL).flush(body);
    fixture.detectChanges();
  }

  function click(selector: string, index = 0): void {
    (el.querySelectorAll(selector)[index] as HTMLElement).click();
    fixture.detectChanges();
  }

  function text(selector: string): string {
    return (el.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  beforeEach(() => sessionStorage.removeItem(COOK_SESSION_KEY));

  afterEach(() => {
    session.clear();
    fixture.destroy();
    sessionStorage.removeItem(COOK_SESSION_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  it('shows a loading state, then the banner, the steps and what to add now', () => {
    setup();
    expect(text('.state')).toContain('Getting the recipe ready');
    load();
    expect(text('app-cook-banner .name')).toBe('Salmon salad');
    expect(text('app-cook-banner .meta')).toContain('2 servings');
    expect(text('app-cook-add-now .eyebrow')).toBe('Step 1 of 3 · add now');
    expect(Array.from(el.querySelectorAll('app-cook-add-now li strong')).map((n) => n.textContent)).toEqual(['Lime', 'Olive oil']);
    expect(text('.step')).toBe('Mix the lime and the oil.');
    expect(el.querySelectorAll('app-cook-steps li').length).toBe(3);
    expect(text('app-cook-ingredients .count')).toBe('0 of 3 added');
    expect(el.querySelector('app-cook-timer')).toBeNull();
    expect(session.viewing()).toBeTrue();
  });

  it('lists only the ingredients of the step, says so when a step adds nothing, and starts with the full list closed', () => {
    setup();
    load();
    expect(Array.from(el.querySelectorAll('app-cook-add-now li strong')).map((n) => n.textContent)).toEqual(['Lime', 'Olive oil']);
    expect(el.querySelector<HTMLDetailsElement>('details.under')?.open).toBeFalse();
    expect(el.querySelector('.middle')?.firstElementChild?.tagName).toBe('APP-COOK-ADD-NOW');
    click('.forward');
    expect(Array.from(el.querySelectorAll('app-cook-add-now li strong')).map((n) => n.textContent)).toEqual(['Salmon']);
    click('.forward');
    expect(el.querySelectorAll('app-cook-add-now li').length).toBe(0);
    expect(text('app-cook-add-now .quiet')).toBe('Nothing new to add in this step');
    expect(el.querySelector('.middle')?.firstElementChild?.tagName).toBe('APP-COOK-ADD-NOW');
  });

  it('keeps the ticks of the step list and of the full list in step, and never blocks Next', () => {
    setup();
    load();
    const box = (selector: string, index: number) => el.querySelectorAll<HTMLInputElement>(`${selector} input[type=checkbox]`)[index];
    box('app-cook-add-now', 0).click();
    fixture.detectChanges();
    expect(session.data()!.added).toEqual(['i3']);
    // The full list names the ingredients in the order the steps use them: lime, oil, salmon.
    expect(box('aside app-cook-ingredients', 0).checked).toBeTrue();
    expect(box('details app-cook-ingredients', 0).checked).toBeTrue();
    expect(text('details.under summary')).toBe('All ingredients · 1 of 3 added');
    box('aside app-cook-ingredients', 1).click();
    fixture.detectChanges();
    expect(box('app-cook-add-now', 1).checked).toBeTrue();
    expect(text('app-cook-add-now .quiet')).toBe('All added');
    box('details app-cook-ingredients', 0).click();
    fixture.detectChanges();
    expect(box('app-cook-add-now', 0).checked).toBeFalse();
    click('.forward');
    expect(text('app-cook-add-now .eyebrow')).toContain('Step 2 of 3');
  });

  it('keeps the ticks through a reload', () => {
    setup();
    load();
    el.querySelectorAll<HTMLInputElement>('app-cook-add-now input[type=checkbox]')[1].click();
    fixture.detectChanges();
    fixture.destroy();
    TestBed.resetTestingModule();
    setup();
    load();
    expect(el.querySelectorAll<HTMLInputElement>('app-cook-add-now input[type=checkbox]')[1].checked).toBeTrue();
    expect(text('details.under summary')).toBe('All ingredients · 1 of 3 added');
  });

  it('puts the ingredients no step names at the end of the full list', () => {
    setup();
    load(wire({ ingredients: [...(wire()['ingredients'] as unknown[]), { ingredientId: 'i4', foodName: 'Salt', displayText: 'salt', grams: 2, foodGroup: null, categoryCode: null }] }));
    expect(text('aside app-cook-ingredients .rest')).toBe('Not in a step');
    const names = Array.from(el.querySelectorAll('aside app-cook-ingredients .name')).map((n) => n.textContent);
    expect(names[names.length - 1]).toBe('Salt');
  });

  it('adds a timer to any step, beside the one found in the text, and runs it like the others', () => {
    setup();
    load();
    click('.forward');
    expect(el.querySelector('app-cook-timer')).not.toBeNull();
    click('app-cook-custom-timers .add');
    const input = el.querySelector('app-cook-custom-timers input[name="timer-name"]') as HTMLInputElement;
    input.value = 'Oven preheating';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    click('app-cook-custom-timers .start');
    expect(session.data()!.customs.length).toBe(1);
    expect(text('app-cook-custom-timers .item .name')).toBe('Oven preheating');
    // The found timer is untouched and can still be started.
    expect(session.data()!.timers[1].phase).toBe('idle');
    // On another step it shows in Also timing and in the bar's live list.
    click('.back');
    expect(text('app-cook-also-timing .what')).toBe('Oven preheating');
    expect(session.liveTimers().length).toBe(1);
    // When it ends away from its step the green bar names it.
    session.tickNow(Date.now() + 301_000);
    fixture.detectChanges();
    expect(text('app-cook-alert .text')).toBe('Step 2: Oven preheating is done');
    click('app-cook-alert .action');
    expect(text('app-cook-add-now .eyebrow')).toContain('Step 2 of 3');
    expect(text('app-cook-custom-timers .item.done')).toContain('Oven preheating is done');
    click('app-cook-custom-timers .item.done button');
    expect(session.data()!.customs).toEqual([]);
  });

  it('labels the found timer, prefills the form with it and shows it in Also timing and the alert', () => {
    setup();
    load(wire({
      steps: [
        { stepNumber: 1, text: 'Heat a large skillet.', title: 'Heat the pan' },
        { stepNumber: 2, text: 'Brown patties in batches, about 10 minutes.', title: 'Brown', ingredientIds: ['i1'], timers: [{ seconds: 600, maxSeconds: null, eachSide: false, phrase: '10 minutes', label: 'Brown patties' }] },
        { stepNumber: 3, text: 'Serve.', title: 'Serve' }
      ]
    }));
    click('.forward');
    expect(text('app-cook-timer .name')).toBe('Brown patties');
    click('app-cook-custom-timers .add');
    const input = el.querySelector('app-cook-custom-timers input[name="timer-name"]') as HTMLInputElement;
    expect(input.value).toBe('Brown patties');
    click('app-cook-custom-timers .buttons .link');
    click('app-cook-timer .slot');
    click('.forward');
    expect(text('app-cook-also-timing .what')).toBe('Step 2 · Brown patties');
    session.tickNow(Date.now() + 601_000);
    fixture.detectChanges();
    expect(text('app-cook-alert .text')).toBe('Step 2 · Brown patties is done');
  });

  it('prefills the form from the step text, else its title, when the step has no timer', () => {
    setup();
    load();
    click('app-cook-custom-timers .add');
    expect((el.querySelector('app-cook-custom-timers input[name="timer-name"]') as HTMLInputElement).value).toBe('Mix the dressing');
    click('.forward');
    click('.forward');
    click('app-cook-custom-timers .add');
    expect((el.querySelector('app-cook-custom-timers input[name="timer-name"]') as HTMLInputElement).value).toBe('Rest');
  });

  it('Algerian Kefta step: the found timer stays visible, and the form starts with its time, never one left from another step', () => {
    setup();
    load(wire({
      steps: [
        { stepNumber: 1, text: 'Preheat the oven.', title: 'Preheat the oven.' },
        { stepNumber: 2, text: 'Brown patties in batches, about 10 minutes.', title: 'Brown', timers: [{ seconds: 600, maxSeconds: null, eachSide: false, phrase: '10 minutes' }] }
      ]
    }));
    click('app-cook-custom-timers .add');
    click('app-cook-custom-timers button[aria-label="Longer"]');
    expect(el.querySelector('app-cook-custom-timers form')).not.toBeNull();
    click('.forward');
    expect(el.querySelector('app-cook-timer')).not.toBeNull();
    expect(el.querySelector('app-cook-custom-timers form')).toBeNull();
    click('app-cook-custom-timers .add');
    expect(el.querySelector('app-cook-timer')).not.toBeNull();
    expect(el.querySelectorAll<HTMLInputElement>('app-cook-custom-timers app-cook-duration input')[1].value).toBe('10');
    expect((el.querySelector('app-cook-custom-timers input[name="timer-name"]') as HTMLInputElement).value).toBe('Brown patties');
    // With the found timer running, the form offers 5 min instead.
    click('app-cook-custom-timers .buttons .link');
    click('app-cook-timer .slot');
    click('app-cook-custom-timers .add');
    expect(el.querySelectorAll<HTMLInputElement>('app-cook-custom-timers app-cook-duration input')[1].value).toBe('5');
  });

  it('offers + Add a timer on a step that has no timer of its own', () => {
    setup();
    load();
    expect(el.querySelector('app-cook-timer')).toBeNull();
    expect(text('app-cook-custom-timers .add')).toContain('Add a timer');
  });

  it('has an Exit control, and Previous step and Next step buttons; nothing else says Back', () => {
    setup();
    load();
    expect(text('app-cook-topbar .exit')).toBe('Exit');
    expect(el.querySelector('app-cook-topbar .exit')?.getAttribute('aria-label')).toBe('Exit cooking');
    expect(text('.back')).toBe('\u2190 Previous step');
    expect(text('.forward')).toBe('Next step \u2192');
    expect(el.textContent).not.toMatch(/\bBack\b/);
  });

  it('marks every ingredient of the step as added with one tap, and clears them again', () => {
    setup();
    load();
    click('app-cook-add-now .all');
    expect(session.data()!.added.sort()).toEqual(['i2', 'i3']);
    expect(text('app-cook-add-now .all')).toBe('Clear all');
    click('app-cook-add-now .all');
    expect(session.data()!.added).toEqual([]);
  });

  it('changes the time of a running timer by tapping it, and the new value becomes the time left', () => {
    setup();
    load();
    click('.forward');
    click('app-cook-timer .slot');
    click('app-cook-timer button.time');
    expect(el.querySelector('app-cook-retime')).not.toBeNull();
    click('app-cook-retime button[aria-label="Longer"]');
    click('app-cook-retime .set');
    const left = session.data()!.timers[1].endsAtMs - Date.now();
    expect(left).toBeGreaterThan(3 * 60_000);
    expect(left).toBeLessThanOrEqual(4 * 60_000);
    expect(el.querySelector('app-cook-retime')).toBeNull();
  });

  it('keeps the session for the Continue cooking banner when the cook leaves with nothing running', async () => {
    setup();
    load();
    click('.forward');
    expect(await fixture.componentInstance.confirmLeave()).toBeTrue();
    expect(session.data()?.step).toBe(1);
    expect(session.viewing()).toBeFalse();
  });

  describe('recording the cook', () => {
    const recordUrl = '/api/v1/nutrition/recipes/r1/cooks';

    function finishCooking(): void {
      setup();
      load(wire({ cookCount: 0 }));
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      click('app-cook-steps li button', 2);
      click('.forward');
    }

    it('sends the cook with the id made at the start, the servings and the times, then shows the card', () => {
      finishCooking();
      expect(el.querySelector('app-cook-finished')).toBeNull();
      const request = http.expectOne(recordUrl);
      expect(request.request.body.clientCookId).toBe(session.data()!.cookId);
      expect(request.request.body.servings).toBe(2);
      expect(new Date(request.request.body.startedAt).getTime()).toBeLessThanOrEqual(new Date(request.request.body.finishedAt).getTime());
      request.flush(null);
      fixture.detectChanges();
      expect(el.querySelector('app-cook-finished')).not.toBeNull();
      expect(el.querySelector('app-cook-finished .earned')).not.toBeNull();
    });

    it('tries once more when it fails, with the same id, and still shows the card when it fails twice', () => {
      finishCooking();
      http.expectOne(recordUrl).flush('no', { status: 500, statusText: 'Server Error' });
      const again = http.expectOne(recordUrl);
      expect(again.request.body.clientCookId).toBe(session.data()!.cookId);
      again.flush('no', { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el.querySelector('app-cook-finished')).not.toBeNull();
    });

    it('does not offer first time for a recipe cooked before, and sends nothing twice for a second tap', () => {
      setup();
      load(wire({ cookCount: 2 }));
      spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      click('app-cook-steps li button', 2);
      click('.forward');
      expect((el.querySelector('.forward') as HTMLButtonElement).disabled).toBeTrue();
      http.expectOne(recordUrl).flush(null);
      fixture.detectChanges();
      expect(el.querySelector('app-cook-finished .earned')).toBeNull();
    });
  });

  it('ends the session after Finish cooking', async () => {
    setup();
    load();
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    click('app-cook-steps li button', 2);
    click('.forward');
    expect(await fixture.componentInstance.confirmLeave()).toBeTrue();
    expect(session.data()).toBeNull();
  });

  it('opens the finish card after the last step with the cooking figures, and Done goes back to the recipe', () => {
    setup();
    load(wire({ perServing: { kcal: 590 } }));
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    session.data.update((data) => (data ? { ...data, startedAt: Date.now() - 42 * 60_000 } : data));
    click('app-cook-steps li button', 2);
    expect(el.querySelector('app-cook-finished')).toBeNull();
    click('.forward');
    http.expectOne('/api/v1/nutrition/recipes/r1/cooks').flush(null);
    fixture.detectChanges();

    expect(el.querySelector('app-cook-finished')).not.toBeNull();
    expect(text('app-cook-finished .name')).toBe('Salmon salad');
    expect(Array.from(el.querySelectorAll('app-cook-finished .facts div')).map((cell) => cell.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['42 min', '3 steps', '2 servings']);
    expect(navigate).not.toHaveBeenCalled();
    expect(text('app-cook-finished .primary')).toBe('Log 2 servings · 1,180 kcal');
  });

  it('scales the amounts to the servings in the query', () => {
    setup('1');
    load();
    click('.forward');
    expect(text('app-cook-add-now .grams')).toBe('100 g');
  });

  it('moves between steps, counts the ingredients used and keeps Back off the first step', () => {
    setup();
    load();
    expect((el.querySelector('.back') as HTMLButtonElement).disabled).toBeTrue();
    click('.forward');
    expect(text('app-cook-add-now .eyebrow')).toBe('Step 2 of 3 · add now');
    expect(text('app-cook-ingredients .count')).toBe('0 of 3 added');
    expect(el.querySelector('.step .phrase')?.textContent).toBe('3-4 mins');
    expect(el.querySelector('.phrase')?.tagName).toBe('SPAN');
    expect(text('details.under summary')).toBe('All ingredients · 0 of 3 added');
    click('.back');
    expect(text('app-cook-add-now .eyebrow')).toBe('Step 1 of 3 · add now');
  });

  it('jumps to a step from the list of steps', () => {
    setup();
    load();
    click('app-cook-steps li button', 2);
    expect(text('app-cook-add-now .eyebrow')).toContain('Step 3 of 3');
    expect(el.querySelector('.forward')?.textContent).toContain('Finish cooking');
  });

  it('shows the timer of a step and starts it', () => {
    setup();
    load();
    click('.forward');
    expect(text('app-cook-timer .slot')).toContain('Start the first side');
    click('app-cook-timer .slot');
    expect(session.data()!.timers[1].phase).toBe('running');
    expect(text('app-cook-timer .slot')).toContain('Pause');
  });

  it('lists the timers of other steps as chips and jumps to one', () => {
    setup();
    load();
    click('.forward');
    click('app-cook-timer .slot');
    click('.back');
    expect(el.querySelectorAll('app-cook-also-timing .chip').length).toBe(1);
    expect(text('app-cook-also-timing .what')).toBe('Step 2 · Fry the salmon');
    click('app-cook-also-timing .chip');
    expect(text('app-cook-add-now .eyebrow')).toContain('Step 2 of 3');
    expect(el.querySelector('app-cook-also-timing')).toBeNull();
  });

  it('shows a bar when a timer ends on another step, and answers it with the next action', () => {
    setup();
    load();
    click('.forward');
    click('app-cook-timer .slot');
    click('.back');
    session.tickNow(Date.now() + 181_000);
    fixture.detectChanges();
    expect(text('app-cook-alert .text')).toBe('Step 2 · Fry the salmon: the first side is done');
    click('app-cook-alert .action');
    expect(session.data()!.timers[1].stage).toBe(1);
    expect(el.querySelector('app-cook-alert')).toBeNull();
  });

  it('keeps the alert until it is answered and lets Later put it away', () => {
    setup();
    load();
    click('.forward');
    click('app-cook-timer .slot');
    click('.back');
    session.tickNow(Date.now() + 181_000);
    fixture.detectChanges();
    session.tickNow(Date.now() + 500_000);
    fixture.detectChanges();
    expect(el.querySelector('app-cook-alert')).not.toBeNull();
    click('app-cook-alert .later');
    expect(el.querySelector('app-cook-alert')).toBeNull();
  });

  it('lets go without a question when no timer runs', async () => {
    setup();
    load();
    expect(await fixture.componentInstance.confirmLeave()).toBeTrue();
    expect(session.data()).toBeNull();
  });

  it('asks about running timers when leaving and keeps them on "Keep them running"', async () => {
    setup();
    load();
    click('.forward');
    click('app-cook-timer .slot');
    const answer = fixture.componentInstance.confirmLeave() as Promise<boolean>;
    fixture.detectChanges();
    expect(text('app-confirm-dialog h2')).toBe('1 timer is still running');
    expect(text('app-confirm-dialog p')).toBe('The timer keeps running in a bar at the bottom of the screen.');
    const buttons = el.querySelectorAll('app-confirm-dialog button');
    expect(buttons[0].textContent).toContain('Keep it running');
    expect(buttons[1].textContent).toContain('Stop it');
    (buttons[0] as HTMLElement).click();
    expect(await answer).toBeTrue();
    expect(session.viewing()).toBeFalse();
    expect(session.hasLive()).toBeTrue();
  });

  it('words the answers for one timer, and for more than one', async () => {
    setup();
    load();
    click('.forward');
    click('app-cook-timer .slot');
    const first = fixture.componentInstance.confirmLeave() as Promise<boolean>;
    fixture.detectChanges();
    let labels = Array.from(el.querySelectorAll('app-confirm-dialog button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Keep it running', 'Stop it']);
    (el.querySelectorAll('app-confirm-dialog button')[0] as HTMLElement).click();
    await first;

    session.addCustom(1, 'Rice', 5);
    const second = fixture.componentInstance.confirmLeave() as Promise<boolean>;
    fixture.detectChanges();
    labels = Array.from(el.querySelectorAll('app-confirm-dialog button')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Keep them running', 'Stop them']);
    (el.querySelectorAll('app-confirm-dialog button')[0] as HTMLElement).click();
    await second;
  });

  it('stops the timers on "Stop them"', async () => {
    setup();
    load();
    click('.forward');
    click('app-cook-timer .slot');
    const answer = fixture.componentInstance.confirmLeave() as Promise<boolean>;
    fixture.detectChanges();
    (el.querySelectorAll('app-confirm-dialog button')[1] as HTMLElement).click();
    expect(await answer).toBeTrue();
    expect(session.data()).toBeNull();
  });

  it('leaves through the navigation when the close button or the last step is used', () => {
    setup();
    load();
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    click('app-cook-topbar .exit');
    expect(navigate).toHaveBeenCalledWith(jasmine.stringMatching(/^\/nutrition\/recipes\/.+/), { replaceUrl: true });
    click('app-cook-steps li button', 2);
    click('.forward');
    // Finish cooking records the cook, then opens the finish card; it leaves for the recipe when answered.
    expect(navigate).toHaveBeenCalledTimes(1);
    http.expectOne('/api/v1/nutrition/recipes/r1/cooks').flush(null);
    fixture.detectChanges();
    click('app-cook-finished .quiet');
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('degrades to a plain list when the steps carry no ingredient ids', () => {
    setup();
    load(wire({}, true));
    expect(text('app-cook-ingredients .count')).toBe('0 of 3 added');
    expect(el.querySelectorAll('app-cook-add-now li').length).toBe(0);
    expect(el.querySelector('app-cook-add-now .quiet')).toBeNull();
    expect(el.querySelector('app-cook-ingredients .rest')).toBeNull();
    expect(text('.handle')).toContain('0 of 3 ingredients added');
  });

  it('shows the phone sheet with the steps and ingredients', () => {
    setup();
    load();
    expect(text('.handle')).toContain('All steps · 0 of 3 ingredients added');
    click('.handle');
    expect(el.querySelector('.sheet')).not.toBeNull();
    click('.sheet app-cook-steps li button', 1);
    expect(el.querySelector('.sheet')).toBeNull();
    expect(text('app-cook-add-now .eyebrow')).toContain('Step 2 of 3');
  });

  it('shows an error with a retry, also for a recipe without steps', () => {
    setup();
    http.expectOne(URL).flush('no', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text('.state')).toContain('could not be opened');
    click('.again');
    load(wire({ steps: [] }));
    expect(text('.state')).toContain('could not be opened');
    click('.again');
    load();
    expect(text('app-cook-banner .name')).toBe('Salmon salad');
  });

  it('follows the theme: no hard-coded dark background on the screen or the timer button', () => {
    setup();
    load();
    click('.forward');
    const host = el;
    const button = el.querySelector('app-cook-timer .slot') as HTMLElement;
    const colours = (theme: string) => {
      document.documentElement.dataset['theme'] = theme;
      return {
        screen: getComputedStyle(host).backgroundColor,
        button: getComputedStyle(button).backgroundColor,
        text: getComputedStyle(el.querySelector('.step') as HTMLElement).color
      };
    };
    const light = colours('light');
    const dark = colours('dark');
    expect(light.screen).not.toBe(dark.screen);
    expect(light.button).not.toBe(dark.button);
    expect(light.text).not.toBe(dark.text);
    document.documentElement.dataset['theme'] = 'light';
    const probe = document.createElement('div');
    probe.style.background = 'var(--bg)';
    document.body.appendChild(probe);
    expect(getComputedStyle(host).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    probe.remove();
  });
});
