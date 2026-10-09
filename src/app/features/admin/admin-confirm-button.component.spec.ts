import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminConfirmButtonComponent } from './admin-confirm-button.component';

@Component({
  imports: [AdminConfirmButtonComponent],
  template: '<app-admin-confirm-button label="Publish" [busy]="busy()" [disabled]="disabled()" (confirmed)="runs = runs + 1" />'
})
class HostComponent {
  runs = 0;
  readonly busy = signal(false);
  readonly disabled = signal(false);
}

describe('AdminConfirmButtonComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let element: HTMLElement;

  const buttons = () => Array.from(element.querySelectorAll('button'));
  const labels = () => buttons().map((button) => button.textContent?.trim());

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('shows one button with the label', () => {
    expect(labels()).toEqual(['Publish']);
  });

  it('turns into Confirm and Cancel side by side after the first press and runs nothing yet', () => {
    buttons()[0].click();
    fixture.detectChanges();

    expect(labels()).toEqual(['Confirm', 'Cancel']);
    expect(fixture.componentInstance.runs).toBe(0);
  });

  it('names the action in the accessible names of Confirm and Cancel', () => {
    buttons()[0].click();
    fixture.detectChanges();

    expect(buttons()[0].getAttribute('aria-label')).toBe('Confirm Publish');
    expect(buttons()[1].getAttribute('aria-label')).toBe('Cancel Publish');
  });

  it('moves the focus to Confirm', () => {
    buttons()[0].click();
    fixture.detectChanges();

    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('runs once after Confirm and returns to the single button', () => {
    buttons()[0].click();
    fixture.detectChanges();
    buttons()[0].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.runs).toBe(1);
    expect(labels()).toEqual(['Publish']);
  });

  it('runs nothing after Cancel and gives the focus back to the button', () => {
    buttons()[0].click();
    fixture.detectChanges();
    buttons()[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.runs).toBe(0);
    expect(labels()).toEqual(['Publish']);
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('cannot run twice when Confirm is clicked twice before the page updates', () => {
    buttons()[0].click();
    fixture.detectChanges();
    const confirm = buttons()[0];

    confirm.click();
    confirm.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.runs).toBe(1);
  });

  it('is disabled and marked busy while the action runs', () => {
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();

    expect(buttons()[0].disabled).toBeTrue();
    expect(buttons()[0].getAttribute('aria-busy')).toBe('true');

    buttons()[0].click();
    fixture.detectChanges();

    expect(labels()).toEqual(['Publish']);
    expect(fixture.componentInstance.runs).toBe(0);
  });

  it('does not ask when it is disabled from outside', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(buttons()[0].disabled).toBeTrue();
    expect(buttons()[0].getAttribute('aria-busy')).toBe('false');
    expect(getComputedStyle(buttons()[0]).cursor).toBe('not-allowed');
  });
});
