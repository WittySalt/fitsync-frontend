import { ComponentFixture, TestBed } from '@angular/core/testing';

import { anchorSteps } from '../../core/guide/guide-testing.spec';
import { PlayerFooterComponent } from './player-footer.component';

describe('PlayerFooterComponent', () => {
  let fixture: ComponentFixture<PlayerFooterComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PlayerFooterComponent] });
    fixture = TestBed.createComponent(PlayerFooterComponent);
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const more = () => root().querySelector<HTMLButtonElement>('[aria-label="More"]') as HTMLButtonElement;
  const named = (label: string) =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === label);

  it('shows Discard workout in red, and keeps skipping an exercise quiet', () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="More"]')?.click();
    fixture.detectChanges();

    expect(named('Discard workout')?.classList.contains('danger')).toBeTrue();
    expect(named('Skip this exercise')?.classList.contains('danger')).toBeFalse();
  });

  it('anchors Finish for the session player path', () => {
    expect(anchorSteps(root(), 'workout-session-player')).toEqual(['finish']);
  });

  it('has Pause and Finish, and no Abort', () => {
    expect(named('Pause')).toBeDefined();
    expect(named('Finish')).toBeDefined();
    expect(root().textContent).not.toContain('Abort');
  });

  it('says Resume while the workout is paused', () => {
    fixture.componentRef.setInput('paused', true);
    fixture.detectChanges();

    expect(named('Resume')).toBeDefined();
  });

  it('opens the menu as a disclosure and closes it with Escape, giving focus back', () => {
    expect(more().getAttribute('aria-expanded')).toBe('false');

    more().click();
    fixture.detectChanges();
    expect(more().getAttribute('aria-expanded')).toBe('true');
    expect(root().querySelector('#player-more-menu')).not.toBeNull();
    expect(more().getAttribute('aria-controls')).toBe('player-more-menu');

    root().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(more().getAttribute('aria-expanded')).toBe('false');
    expect(root().querySelector('#player-more-menu')).toBeNull();
  });

  it('closes the menu on a tap outside it', () => {
    more().click();
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();

    expect(more().getAttribute('aria-expanded')).toBe('false');
  });

  it('offers Skip this exercise and Discard workout, and closes after either', () => {
    const skipped = jasmine.createSpy('skipExercise');
    const discarded = jasmine.createSpy('discard');
    fixture.componentInstance.skipExercise.subscribe(skipped);
    fixture.componentInstance.discard.subscribe(discarded);

    more().click();
    fixture.detectChanges();
    named('Skip this exercise')?.click();
    fixture.detectChanges();
    expect(skipped).toHaveBeenCalledTimes(1);
    expect(root().querySelector('#player-more-menu')).toBeNull();

    more().click();
    fixture.detectChanges();
    named('Discard workout')?.click();
    expect(discarded).toHaveBeenCalledTimes(1);
  });

  it('says Pause and Finish to its owner', () => {
    const paused = jasmine.createSpy('pauseToggle');
    const finished = jasmine.createSpy('finishRequest');
    fixture.componentInstance.pauseToggle.subscribe(paused);
    fixture.componentInstance.finishRequest.subscribe(finished);

    named('Pause')?.click();
    named('Finish')?.click();

    expect(paused).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledTimes(1);
  });
});
