import { TestBed } from '@angular/core/testing';

import { ToastService } from '../core/toast/toast.service';
import { ToastOutletComponent } from './toast-outlet.component';

describe('ToastOutletComponent', () => {
  it('shows an action button on a toast that has one and runs it on a click', () => {
    const fixture = TestBed.createComponent(ToastOutletComponent);
    const toasts = TestBed.inject(ToastService);
    const run = jasmine.createSpy('run');
    toasts.success('Added a glass of water.', 0, { label: 'Undo', run });
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.toast-action');
    expect(button.textContent?.trim()).toBe('Undo');
    button.click();
    fixture.detectChanges();

    expect(run).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });

  it('shows no action button on a plain toast', () => {
    const fixture = TestBed.createComponent(ToastOutletComponent);
    TestBed.inject(ToastService).info('Hello', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast-action')).toBeNull();
  });
});
