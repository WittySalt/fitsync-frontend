import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CoachStore } from '../../core/coach/coach.store';
import { ContentsRailComponent, currentSection } from './contents-rail.component';
import { DetailHeadComponent, cameFromThisApp } from './detail-head.component';
import { DetailLayoutComponent } from './detail-layout.component';
import { DetailSectionComponent } from './detail-section.component';
import { InkSwitchComponent } from './ink-switch.component';
import { ProgressCardContext } from './progress.models';

const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const card: ProgressCardContext = { kind: 'GOAL', from: '2026-09-06', to: '2026-10-03' };

describe('currentSection', () => {
  const tops = (...values: number[]) => values.map((top, k) => ({ id: `s${k}`, top }));

  it('is the first section while none has passed the line', () => {
    expect(currentSection(tops(300, 900, 1500))).toBe('s0');
  });

  it('is the last section whose top has passed the line', () => {
    expect(currentSection(tops(-1200, -300, 60, 700))).toBe('s2');
    expect(currentSection(tops(-1200, -300, 96, 700))).toBe('s2');
    expect(currentSection(tops(-1200, -300, 97, 700))).toBe('s1');
  });

  it('is the last section at the foot of the page, even when it is too short to reach the line', () => {
    expect(currentSection(tops(-1200, -300, 400), 96, true)).toBe('s2');
  });

  it('is nothing without sections', () => {
    expect(currentSection([])).toBeNull();
  });
});

describe('ContentsRailComponent', () => {
  const callbacks: (() => void)[] = [];
  let real: typeof IntersectionObserver;
  let host: HTMLElement;
  let tops: Record<string, number>;

  class FakeObserver {
    constructor(callback: () => void) {
      callbacks.push(callback);
    }
    observe(): void {}
    disconnect(): void {}
  }

  beforeEach(() => {
    real = window.IntersectionObserver;
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver;
    callbacks.length = 0;
    tops = { weight: 40, body: 700, pace: 1400 };
    host = document.createElement('div');
    for (const id of Object.keys(tops)) {
      const section = document.createElement('section');
      section.id = id;
      section.getBoundingClientRect = () => ({ top: tops[id] }) as DOMRect;
      host.appendChild(section);
    }
    document.body.appendChild(host);
  });

  afterEach(() => {
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = real;
    host.remove();
  });

  function create() {
    const fixture = TestBed.createComponent(ContentsRailComponent);
    fixture.componentRef.setInput('items', [
      { id: 'weight', label: 'Weight' },
      { id: 'body', label: 'Body' },
      { id: 'pace', label: 'Pace' }
    ]);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
    return fixture;
  }

  it('lists the sections of the page and marks the first as current at the top', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.item')).map((item) => text(item))).toEqual(['Weight', 'Body', 'Pace']);
    expect(el.querySelector('.item.on')?.textContent?.trim()).toBe('Weight');
    expect(el.querySelector('.item.on')?.getAttribute('aria-current')).toBe('true');
  });

  it('follows the scroll: when a section crosses the line the observer reports it', () => {
    const fixture = create();
    tops = { weight: -900, body: 60, pace: 700 };
    callbacks.forEach((callback) => callback());
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.item.on')?.textContent?.trim()).toBe('Body');
    tops = { weight: -1700, body: -800, pace: 90 };
    callbacks.forEach((callback) => callback());
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.item.on')?.textContent?.trim()).toBe('Pace');
  });

  it('scrolls to the section it is given and writes nothing to the address', () => {
    const fixture = create();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate');
    const navigateByUrl = spyOn(router, 'navigateByUrl');
    const scroll = spyOn(Element.prototype, 'scrollIntoView');
    const link = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.item')[2];
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    fixture.detectChanges();
    expect(event.defaultPrevented).toBeTrue();
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(link.classList).toContain('on');
    expect(navigate).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('draws nothing without sections', () => {
    const fixture = TestBed.createComponent(ContentsRailComponent);
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });
});

describe('DetailHeadComponent', () => {
  let back: jasmine.Spy;
  let navigate: jasmine.Spy;
  let saved: unknown;

  beforeEach(() => {
    saved = history.state;
    back = jasmine.createSpy('back');
    navigate = jasmine.createSpy('navigateByUrl').and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: Location, useValue: { back } },
        { provide: Router, useValue: { navigateByUrl: navigate } }
      ]
    });
  });

  afterEach(() => history.replaceState(saved, ''));

  function create(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(DetailHeadComponent);
    fixture.componentRef.setInput('eyebrow', 'GOAL · THE LAST 4 WEEKS');
    fixture.componentRef.setInput('verdict', 'Ahead of schedule.');
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('knows when the entry before is a page of this app', () => {
    expect(cameFromThisApp({ navigationId: 3 })).toBeTrue();
    expect(cameFromThisApp({ navigationId: 1 })).toBeFalse();
    expect(cameFromThisApp(null)).toBeFalse();
  });

  it('goes back one step in the history when the page was reached inside the app', () => {
    history.replaceState({ navigationId: 4 }, '');
    create().querySelector<HTMLButtonElement>('.back')!.click();
    expect(back).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens the fallback page when the page was opened from a link, so back never leaves the app', () => {
    history.replaceState({ navigationId: 1 }, '');
    create().querySelector<HTMLButtonElement>('.back')!.click();
    expect(back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledOnceWith('/progress');
  });

  it('uses the page it is told to fall back to', () => {
    history.replaceState(null, '');
    create({ fallback: '/progress/training', backLabel: 'Training' }).querySelector<HTMLButtonElement>('.back')!.click();
    expect(navigate).toHaveBeenCalledOnceWith('/progress/training');
  });

  it('writes the eyebrow, the verdict in green or ink, the sentence and the figures as a row', () => {
    const el = create({
      tone: 'ink',
      sentence: '71.2 kg now.',
      stats: [
        { label: 'Now', value: '71.2', unit: 'kg', context: 'No earlier data' },
        { label: 'A week', value: '–' }
      ]
    });
    expect(text(el.querySelector('.eyebrow'))).toBe('GOAL · THE LAST 4 WEEKS');
    expect(text(el.querySelector('h1'))).toBe('Ahead of schedule.');
    expect(el.querySelector('h1')?.classList).toContain('ink');
    expect(text(el.querySelector('.sentence'))).toBe('71.2 kg now.');
    expect(Array.from(el.querySelectorAll('dt')).map((dt) => text(dt))).toEqual(['Now', 'A week']);
    expect(text(el.querySelector('.value'))).toBe('71.2 kg');
    expect(text(el.querySelector('.context'))).toBe('No earlier data');
  });

  it('is green for a good answer', () => {
    expect(create().querySelector('h1')?.classList).not.toContain('ink');
  });
});

describe('InkSwitchComponent', () => {
  it('writes the choices as text, the current one pressed, and says which was picked', () => {
    const fixture = TestBed.createComponent(InkSwitchComponent);
    fixture.componentRef.setInput('options', [
      { value: '4w', label: '4 weeks' },
      { value: '3m', label: '3 months' }
    ]);
    fixture.componentRef.setInput('value', '4w');
    fixture.componentRef.setInput('label', 'Period');
    const picked: string[] = [];
    fixture.componentInstance.picked.subscribe((value) => picked.push(value));
    fixture.detectChanges();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].classList).toContain('on');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    buttons[1].click();
    expect(picked).toEqual(['3m']);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Period');
  });
});

@Component({
  imports: [DetailLayoutComponent, DetailSectionComponent, InkSwitchComponent],
  template: `
    <app-detail-layout>
      <p detailHead class="head">the head</p>
      <p detailRail class="rail">the rail</p>
      <app-detail-section name="Weight" anchor="weight" sentence="One sentence." [context]="context" ask="How is the date worked out?">
        <app-ink-switch sectionControl [options]="[{ value: 'a', label: 'A' }]" value="a" />
        <i class="picture">picture</i>
      </app-detail-section>
      <app-detail-section name="Body" />
    </app-detail-layout>
  `
})
class SectionsHost {
  readonly context = card;
}

describe('DetailSectionComponent and DetailLayoutComponent', () => {
  let coach: { askAboutCard: jasmine.Spy };

  beforeEach(() => {
    coach = { askAboutCard: jasmine.createSpy('askAboutCard') };
    TestBed.configureTestingModule({ providers: [{ provide: CoachStore, useValue: coach }] });
  });

  it('sets a section as its name, one sentence and the picture, with the Ask pill in the head row', () => {
    const fixture = TestBed.createComponent(SectionsHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const weight = el.querySelector('#weight')!;
    expect(text(weight.querySelector('h2'))).toBe('Weight');
    expect(text(weight.querySelector('.sentence'))).toBe('One sentence.');
    expect(weight.querySelector('.head .tools app-ink-switch')).not.toBeNull();
    expect(weight.querySelector('.picture')).not.toBeNull();
    expect(text(weight.querySelector('.head .tools .ask'))).toBe('Ask');
    expect(weight.querySelector('.sub, .quiet')).toBeNull();
  });

  it('opens the coach with the section as the subject and the old explanation as the question', () => {
    const fixture = TestBed.createComponent(SectionsHost);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#weight .ask')!.click();
    expect(coach.askAboutCard).toHaveBeenCalledOnceWith(card, 'How is the date worked out?');
  });

  it('has no Ask without a card to ask about, and no sentence line without a sentence', () => {
    const fixture = TestBed.createComponent(SectionsHost);
    fixture.detectChanges();
    const bodies = (fixture.nativeElement as HTMLElement).querySelectorAll('app-detail-section');
    expect(bodies[1].querySelector('.ask')).toBeNull();
    expect(bodies[1].querySelector('.sentence')).toBeNull();
  });

  it('puts the head, the rail and the sections in their places', () => {
    const fixture = TestBed.createComponent(SectionsHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('main > .head')).not.toBeNull();
    expect(el.querySelector('.body > .rail')).not.toBeNull();
    expect(el.querySelectorAll('.body .sections > app-detail-section').length).toBe(2);
  });
});

describe('DetailHeadComponent in the first-run guide', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function create(surface: string | null): HTMLElement {
    const fixture = TestBed.createComponent(DetailHeadComponent);
    fixture.componentRef.setInput('eyebrow', 'GOAL');
    fixture.componentRef.setInput('verdict', 'Ahead of schedule.');
    fixture.componentRef.setInput('surface', surface);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers How this works on a page that has a surface, in the head row', () => {
    const el = create('progress-goal');
    expect(text(el.querySelector('.line app-how-this-works'))).toBe('How this works');
  });

  it('has no link on a page without a surface', () => {
    expect(create(null).querySelector('app-how-this-works')).toBeNull();
  });
});
