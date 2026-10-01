import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('adds a success toast', () => {
    service.success('Saved');
    const toasts = service.toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Saved');
  });

  it('ignores empty messages', () => {
    service.show('');
    expect(service.toasts().length).toBe(0);
  });

  it('dismisses a toast by id', () => {
    service.error('Boom', 0);
    const id = service.toasts()[0].id;
    service.dismiss(id);
    expect(service.toasts().length).toBe(0);
  });

  it('auto-dismisses after the duration', fakeAsync(() => {
    service.info('Hi', 1000);
    expect(service.toasts().length).toBe(1);
    tick(1000);
    expect(service.toasts().length).toBe(0);
  }));

  it('keeps an action on the toast and runs it once, taking the toast away', () => {
    const run = jasmine.createSpy('run');
    service.success('Added a glass of water.', 0, { label: 'Undo', run });
    const toast = service.toasts()[0];
    expect(toast.action?.label).toBe('Undo');
    service.runAction(toast.id);
    expect(run).toHaveBeenCalledTimes(1);
    expect(service.toasts().length).toBe(0);
    service.runAction(toast.id);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('leaves the action off a plain toast', () => {
    service.success('Saved');
    expect('action' in service.toasts()[0]).toBeFalse();
  });
});
