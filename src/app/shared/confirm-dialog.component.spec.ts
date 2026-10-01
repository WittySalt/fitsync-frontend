import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  imports: [ConfirmDialogComponent],
  template: `
    <app-confirm-dialog
      title="Delete Lunch?"
      message="Its foods are removed from Friday 2 Oct."
      confirmLabel="Delete"
      [danger]="true"
      [busy]="busy"
      (confirmed)="confirmed = confirmed + 1"
      (cancelled)="cancelled = cancelled + 1"
    />
  `
})
class HostComponent {
  busy = false;
  confirmed = 0;
  cancelled = 0;
}

describe('ConfirmDialogComponent', () => {
  function open() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('asks with the title and message and puts the focus on the safe answer', async () => {
    const fixture = open();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('h2')?.textContent).toBe('Delete Lunch?');
    expect(element.querySelector('[role="alertdialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel');
  });

  it('draws a destructive confirm in the danger style and confirms on a click', () => {
    const fixture = open();
    const confirm: HTMLButtonElement = fixture.nativeElement.querySelector('.confirm');
    expect(confirm.classList.contains('danger')).toBeTrue();
    expect(confirm.textContent?.trim()).toBe('Delete');
    confirm.click();
    expect(fixture.componentInstance.confirmed).toBe(1);
  });

  it('cancels on the cancel button, the backdrop and Escape', () => {
    const fixture = open();
    (fixture.nativeElement.querySelector('.cancel') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.backdrop') as HTMLElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.cancelled).toBe(3);
  });

  it('cannot be answered or escaped while busy', () => {
    const fixture = open();
    fixture.componentInstance.busy = true;
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.confirm') as HTMLButtonElement).disabled).toBeTrue();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.cancelled).toBe(0);
  });
});
