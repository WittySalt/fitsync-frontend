import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { WorkoutModalComponent } from './workout-modal.component';

@Component({
  imports: [WorkoutModalComponent],
  template: `
    <button id="opener" type="button">Open</button>
    @if (open()) {
      <app-workout-modal heading="A question" (dismissed)="dismissals = dismissals + 1">
        <button id="first" type="button">First</button>
        <button id="second" type="button">Second</button>
      </app-workout-modal>
    }
  `
})
class HostComponent {
  readonly open = signal(false);
  dismissals = 0;
}

describe('WorkoutModalComponent', () => {
  async function show() {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const opener = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#opener')!;
    opener.focus();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, opener, root: fixture.nativeElement as HTMLElement };
  }

  it('opens as a modal dialog named by its heading, and moves focus into it', async () => {
    const { fixture, root } = await show();
    const dialog = root.querySelector('dialog') as HTMLDialogElement;

    expect(dialog.open).toBeTrue();
    expect(dialog.matches(':modal')).toBeTrue();
    expect(dialog.getAttribute('aria-labelledby')).toBe(root.querySelector('h2')?.id ?? 'missing');
    expect(root.querySelector('h2')?.textContent).toBe('A question');
    expect(dialog.contains(document.activeElement)).toBeTrue();

    fixture.destroy();
  });

  it('turns Escape into a dismissal and leaves the removal to its owner', async () => {
    const { fixture, root } = await show();
    const dialog = root.querySelector('dialog') as HTMLDialogElement;
    const cancel = new Event('cancel', { cancelable: true });

    dialog.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBeTrue();
    expect(fixture.componentInstance.dismissals).toBe(1);
    expect(dialog.open).toBeTrue();

    fixture.destroy();
  });

  it('gives focus back to what had it when it goes', async () => {
    const { fixture, opener } = await show();

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(opener);

    fixture.destroy();
  });
});
