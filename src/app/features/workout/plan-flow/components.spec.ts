import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KindTilesComponent } from './kind-tiles.component';
import { DraftDay, DraftMove, DraftPlan, emptyPlan, emptyWeek } from './plan-draft';
import { PlanEntrySheetComponent } from './plan-entry-sheet.component';
import { ReviewStepComponent } from './review-step.component';
import { weekFigures } from './plan-summary';
import { WeekPanelComponent } from './week-panel.component';
import { WeekStripComponent } from './week-strip.component';
import { WIDE_MIN } from './width-band';
import { EntryTarget } from './plan-entry';

const move: DraftMove = {
  exerciseId: 'e',
  name: 'Dumbbell Bench Press',
  meta: '',
  imageUrl: null,
  timed: false,
  sets: 3,
  reps: 10,
  durationSeconds: null,
  weightKg: null,
  restSeconds: 75,
  tempoSeconds: null,
  notes: ''
};

function days(): DraftDay[] {
  return emptyWeek().map((day) => {
    if (day.dayOfWeek === 1) {
      return { ...day, kind: 'STRENGTH' as const, title: 'Full body A', minutes: 45, moves: [move] };
    }
    if (day.dayOfWeek === 3) {
      return { ...day, kind: 'CARDIO' as const, title: 'Easy run', minutes: 30, location: 'TREADMILL' as const };
    }
    return day;
  });
}

/** Sets the width of the host before the first render, which is when a component measures its own band. */
function withWidth<T>(fixture: ComponentFixture<T>, width: number): void {
  (fixture.nativeElement as HTMLElement).style.display = 'block';
  (fixture.nativeElement as HTMLElement).style.width = `${width}px`;
}

describe('WeekStripComponent', () => {
  function render(width: number): HTMLElement {
    const fixture = TestBed.createComponent(WeekStripComponent);
    withWidth(fixture, width);
    fixture.componentRef.setInput('days', days());
    fixture.componentRef.setInput('selected', 1);
    fixture.detectChanges();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows weekday, glyph, title and duration at wide width', () => {
    const root = render(1000);
    const strip = root.querySelector('.strip')!;
    expect(strip.getAttribute('data-band')).toBe('wide');
    expect(root.querySelectorAll('.tile').length).toBe(7);
    const first = root.querySelector('.tile')!;
    expect(first.querySelector('.weekday')?.textContent).toBe('Mon');
    expect(first.querySelector('.title')?.textContent).toBe('Full body A');
    expect(first.querySelector('.minutes')?.textContent).toBe('45 min');
    expect(first.querySelector('app-plan-day-glyph')).not.toBeNull();
  });

  it('drops the title at medium width', () => {
    const root = render(700);
    expect(root.querySelector('.strip')!.getAttribute('data-band')).toBe('medium');
    expect(root.querySelector('.title')).toBeNull();
    expect(root.querySelector('.minutes')?.textContent).toBe('45 min');
  });

  it('shows only the weekday letter and the glyph at narrow width', () => {
    const root = render(360);
    expect(root.querySelector('.strip')!.getAttribute('data-band')).toBe('narrow');
    expect(root.querySelector('.title')).toBeNull();
    expect(root.querySelector('.minutes')).toBeNull();
    expect(root.querySelector('.weekday')?.textContent).toBe('M');
  });

  it('outlines the selected tile and announces each day in words', () => {
    const root = render(1000);
    const tiles = Array.from(root.querySelectorAll<HTMLButtonElement>('.tile'));
    expect(tiles[0].classList).toContain('on');
    expect(tiles[0].getAttribute('aria-pressed')).toBe('true');
    expect(tiles[0].getAttribute('aria-label')).toBe('Mon, Strength, Full body A, 45 minutes');
    expect(tiles[1].getAttribute('aria-label')).toBe('Tue, rest day');
  });

  it('emits the day that was picked and the pair that was dragged', () => {
    const fixture = TestBed.createComponent(WeekStripComponent);
    fixture.componentRef.setInput('days', days());
    fixture.componentRef.setInput('selected', 1);
    fixture.detectChanges();
    const picked: number[] = [];
    const moved: Array<{ from: number; to: number }> = [];
    fixture.componentInstance.pick.subscribe((day) => picked.push(day));
    fixture.componentInstance.move.subscribe((pair) => moved.push(pair));
    const tiles = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.tile'));
    tiles[2].click();
    expect(picked).toEqual([3]);

    const transfer = new DataTransfer();
    tiles[0].dispatchEvent(new DragEvent('dragstart', { dataTransfer: transfer, bubbles: true }));
    tiles[4].dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    tiles[4].dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    expect(moved).toEqual([{ from: 1, to: 5 }]);

    tiles[1].dispatchEvent(new DragEvent('dragstart', { dataTransfer: transfer, bubbles: true }));
    tiles[1].dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    expect(moved.length).toBe(1);
  });
});

describe('KindTilesComponent', () => {
  it('offers the five kinds and marks the current one', () => {
    const fixture = TestBed.createComponent(KindTilesComponent);
    fixture.componentRef.setInput('current', 'CARDIO');
    fixture.detectChanges();
    const chosen: string[] = [];
    fixture.componentInstance.choose.subscribe((kind) => chosen.push(kind));
    const tiles = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.tile'));
    expect(tiles.map((tile) => tile.textContent?.trim())).toEqual(['Rest', 'Strength', 'Cardio', 'Sport', 'Mobility']);
    expect(tiles[2].getAttribute('aria-pressed')).toBe('true');
    tiles[3].click();
    expect(chosen).toEqual(['SPORT']);
  });
});

describe('WeekPanelComponent', () => {
  let fixture: ComponentFixture<WeekPanelComponent>;

  function render(over: Record<string, unknown>): HTMLElement {
    fixture = TestBed.createComponent(WeekPanelComponent);
    fixture.componentRef.setInput('figures', weekFigures(days()));
    fixture.componentRef.setInput('shortLine', '1 strength · 1 cardio · 75 min');
    Object.entries(over).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the four figures, the figure pair with its key and the reading lines when coverage answered', () => {
    const root = render({ coverage: { groups: [{ group: 'CHEST', setsPerWeek: 9 }], notes: [] }, lines: ['Calves are not trained yet.'] });
    expect(Array.from(root.querySelectorAll('dt')).map((term) => term.textContent)).toEqual(['Strength days', 'Cardio days', 'Sport days', 'Minutes a week']);
    expect(root.querySelector('app-muscle-figure')).not.toBeNull();
    expect(root.querySelectorAll('.key li').length).toBe(4);
    expect(root.querySelector('.lines li')?.textContent).toBe('Calves are not trained yet.');
  });

  it('hides the figure and the key when coverage did not answer, and keeps the figures', () => {
    const root = render({ coverage: null });
    expect(root.querySelector('app-muscle-figure')).toBeNull();
    expect(root.querySelector('.key')).toBeNull();
    expect(root.querySelectorAll('dd').length).toBe(4);
  });

  it('folds to one line with a Details button that opens the same content', () => {
    const root = render({ folded: true, coverage: { groups: [], notes: [] } });
    expect(root.querySelector('.short')?.textContent).toBe('1 strength · 1 cardio · 75 min');
    expect(root.querySelector('.figures')).toBeNull();
    const details = root.querySelector<HTMLButtonElement>('.details')!;
    expect(details.textContent?.trim()).toBe('Details');
    details.click();
    fixture.detectChanges();
    expect(details.getAttribute('aria-expanded')).toBe('true');
    expect(details.textContent?.trim()).toBe('Hide');
    expect(root.querySelector('.figures')).not.toBeNull();
  });
});

describe('PlanEntrySheetComponent', () => {
  function render(): { root: HTMLElement; chosen: EntryTarget[]; dismissed: number[]; fixture: ComponentFixture<PlanEntrySheetComponent> } {
    const fixture = TestBed.createComponent(PlanEntrySheetComponent);
    const chosen: EntryTarget[] = [];
    const dismissed: number[] = [];
    fixture.componentInstance.chosen.subscribe((target) => chosen.push(target));
    fixture.componentInstance.dismissed.subscribe(() => dismissed.push(1));
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, chosen, dismissed, fixture };
  }

  it('has the three rows', () => {
    const { root } = render();
    expect(Array.from(root.querySelectorAll('.row strong')).map((row) => row.textContent)).toEqual([
      'Start from a template',
      'Ask the coach to draft it',
      'Build my own'
    ]);
    expect(root.querySelector('.ask')?.textContent).toContain('Ask');
  });

  it('opens the template list and chooses a template', () => {
    const { root, chosen, fixture } = render();
    expect(root.querySelector('.templates')).toBeNull();
    root.querySelector<HTMLButtonElement>('.row')!.click();
    fixture.detectChanges();
    const first = root.querySelector<HTMLButtonElement>('.templates button')!;
    first.click();
    expect(chosen[0].commands).toEqual(['/workout/plans/new']);
    expect(chosen[0].queryParams?.['template']).toBe('full-body-beginner');
  });

  it('chooses the coach and the own build, and can be dismissed', () => {
    const { root, chosen, dismissed } = render();
    const rows = Array.from(root.querySelectorAll<HTMLButtonElement>('.row'));
    rows[1].click();
    rows[2].click();
    expect(chosen.map((target) => target.commands[0])).toEqual(['/coach/plan', '/workout/plans/new']);
    root.querySelector<HTMLButtonElement>('.foot button')!.click();
    expect(dismissed.length).toBe(1);
  });
});

describe('ReviewStepComponent', () => {
  function render(width: number, over: Record<string, unknown> = {}): { fixture: ComponentFixture<ReviewStepComponent>; root: HTMLElement } {
    const fixture = TestBed.createComponent(ReviewStepComponent);
    withWidth(fixture, width);
    const plan: DraftPlan = { ...emptyPlan(), name: 'Strength and running, 2 days', planType: 'MIXED', days: days() };
    fixture.componentRef.setInput('plan', plan);
    fixture.componentRef.setInput('figures', weekFigures(plan.days));
    Object.entries(over).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    fixture.detectChanges();
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('is one column per day at wide width, rest days quiet', () => {
    const { root } = render(1000);
    expect(root.querySelectorAll('.week .col').length).toBe(7);
    expect(root.querySelectorAll('.week .col.rest').length).toBe(5);
    expect(root.querySelector('.list')).toBeNull();
    expect(root.querySelector('.week .col .line')?.textContent).toBe('Dumbbell Bench Press 3 × 10');
  });

  it('is a list with one row per training day at medium and narrow width', () => {
    for (const width of [700, 360]) {
      const { root } = render(width);
      expect(root.querySelector('.week')).toBeNull();
      const rows = Array.from(root.querySelectorAll('.list li'));
      expect(rows.length).toBe(2);
      expect(rows[1].textContent).toContain('Wed · Easy run');
      expect(rows[1].textContent).toContain('30 min · treadmill');
    }
  });

  it('shows the four figures', () => {
    const { root } = render(1000);
    expect(Array.from(root.querySelectorAll('.figures dt')).map((term) => term.textContent)).toEqual(['Days', 'Minutes a week', 'Moves', 'Sets a week']);
    expect(Array.from(root.querySelectorAll('.figures dd')).map((value) => value.textContent)).toEqual(['2', '1 h 15 min', '1', '3']);
  });

  it('says what switching the current plan does only while the toggle is off', () => {
    const off = render(1000, { makeCurrent: false, currentPlanName: 'Recomp Strength + Cardio' });
    expect(off.root.querySelector('.hint')?.textContent).toContain('Your current plan is Recomp Strength + Cardio; switching archives nothing.');
    const on = render(1000, { makeCurrent: true, currentPlanName: 'Recomp Strength + Cardio' });
    expect(on.root.querySelector('.hint')).toBeNull();
    expect(on.root.querySelector('.switch')!.getAttribute('aria-checked')).toBe('true');
  });

  it('emits the edits, Back and Save, and names the button by what it does', () => {
    const { fixture, root } = render(1000);
    const events: string[] = [];
    fixture.componentInstance.nameChange.subscribe((value) => events.push('name:' + value));
    fixture.componentInstance.makeCurrentChange.subscribe((value) => events.push('current:' + value));
    fixture.componentInstance.back.subscribe(() => events.push('back'));
    fixture.componentInstance.save.subscribe(() => events.push('save'));
    const input = root.querySelector<HTMLInputElement>('.name input')!;
    input.value = 'Mine';
    input.dispatchEvent(new Event('input'));
    root.querySelector<HTMLButtonElement>('.switch')!.click();
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.actions button'));
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['Back', 'Save plan']);
    buttons[0].click();
    buttons[1].click();
    expect(events).toEqual(['name:Mine', 'current:true', 'back', 'save']);
  });

  it('shows the problem, the saving state and the edit wording', () => {
    const { root } = render(1000, { message: 'Give the plan a name.', saving: true, editing: true });
    expect(root.querySelector('.problem')?.textContent).toBe('Give the plan a name.');
    const save = root.querySelectorAll<HTMLButtonElement>('.actions button')[1];
    expect(save.textContent?.trim()).toBe('Saving...');
    expect(save.disabled).toBeTrue();
    expect(render(1000, { editing: true }).root.querySelectorAll('.actions button')[1].textContent?.trim()).toBe('Save changes');
  });

  it('knows the wide threshold', () => {
    expect(WIDE_MIN).toBe(900);
  });
});
