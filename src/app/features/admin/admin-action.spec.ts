import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { ActionResult, AdminAction, isForbidden } from './admin-action';
import { AdminActionStatusComponent } from './admin-action-status.component';

describe('AdminAction', () => {
  let action: AdminAction;

  beforeEach(() => {
    action = TestBed.runInInjectionContext(() => new AdminAction());
  });

  it('starts idle', () => {
    expect(action.busy()).toBeFalse();
    expect(action.result()).toBeNull();
  });

  it('is busy while the request runs and then reports the described result', () => {
    const request = new Subject<number>();
    action.run(() => request, (value) => `Done ${value}.`);

    expect(action.busy()).toBeTrue();
    expect(action.result()).toBeNull();

    request.next(4);
    request.complete();

    expect(action.busy()).toBeFalse();
    expect(action.result()).toEqual({ kind: 'success', message: 'Done 4.' });
  });

  it('runs the follow-up only after a success', () => {
    const followed: number[] = [];
    action.run(() => of(3), () => 'ok', (value) => followed.push(value));
    action.run(() => throwError(() => new HttpErrorResponse({ status: 500 })), () => 'ok', (value: number) => followed.push(value));

    expect(followed).toEqual([3]);
  });

  it('does not start a second request while the first one runs', () => {
    const request = new Subject<number>();
    const start = jasmine.createSpy('start').and.returnValue(request);

    action.run(start, () => 'ok');
    action.run(start, () => 'ok');

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('reports a failure in words that reveal nothing and is free to run again', () => {
    action.run(() => throwError(() => new HttpErrorResponse({ status: 500, error: 'stack trace' })), () => 'ok');

    expect(action.busy()).toBeFalse();
    expect(action.result()).toEqual({ kind: 'error', message: 'It did not run. Try again.' });

    action.run(() => of(1), () => 'Second try.');
    expect(action.result()).toEqual({ kind: 'success', message: 'Second try.' });
  });

  it('names the reason when the server refuses the caller', () => {
    action.run(() => throwError(() => new HttpErrorResponse({ status: 403 })), () => 'ok');

    expect(action.result()).toEqual({ kind: 'error', message: 'This action is for administrators.' });
  });

  it('drops a running request and its result when it is reset', () => {
    const request = new Subject<number>();
    action.run(() => request, () => 'late');

    action.reset();
    request.next(1);

    expect(action.busy()).toBeFalse();
    expect(action.result()).toBeNull();
  });

  it('tells a refusal from other failures', () => {
    expect(isForbidden(new HttpErrorResponse({ status: 403 }))).toBeTrue();
    expect(isForbidden(new HttpErrorResponse({ status: 401 }))).toBeFalse();
    expect(isForbidden(new Error('x'))).toBeFalse();
  });
});

@Component({
  imports: [AdminActionStatusComponent],
  template: '<app-admin-action-status [result]="result()" />'
})
class StatusHostComponent {
  readonly result = signal<ActionResult | null>(null);
}

describe('AdminActionStatusComponent', () => {
  it('keeps an empty live region until there is something to say, then shows the message', () => {
    const fixture = TestBed.createComponent(StatusHostComponent);
    fixture.detectChanges();
    const region = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;

    expect(region).not.toBeNull();
    expect(region.textContent?.trim()).toBe('');

    fixture.componentInstance.result.set({ kind: 'success', message: 'Published 3.' });
    fixture.detectChanges();

    expect(region.textContent?.trim()).toBe('Published 3.');
    expect(region.querySelector('.status')?.getAttribute('data-kind')).toBe('success');

    fixture.componentInstance.result.set({ kind: 'error', message: 'It did not run. Try again.' });
    fixture.detectChanges();

    expect(region.querySelector('.status')?.getAttribute('data-kind')).toBe('error');
  });
});
