import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AdminApiService, EmailKindAvailability, EmailSendResult } from './admin-api.service';
import { AdminSendEmailComponent, sendErrorMessage } from './admin-send-email.component';

function availability(overrides: Partial<Record<EmailKindAvailability['kind'], Partial<EmailKindAvailability>>> = {}): EmailKindAvailability[] {
  return (['TRAINING_REMINDER', 'GOAL_REACHED', 'WEEKLY_REPORT'] as const).map((kind) => ({
    kind,
    available: true,
    reason: null,
    message: null,
    ...overrides[kind]
  }));
}

function apiError(status: number, code: string, message?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: {
      timestamp: '2026-10-09T08:00:00Z',
      status,
      error: 'Error',
      code,
      message,
      path: '/api/v1/admin/notifications/users/u-1/emails',
      details: [],
      correlationId: 'c-1'
    }
  });
}

function text(target: Element | null | undefined): string {
  return (target?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('AdminSendEmailComponent', () => {
  let fixture: ComponentFixture<AdminSendEmailComponent>;
  let api: jasmine.SpyObj<AdminApiService>;
  let element: HTMLElement;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', ['getEmailAvailability', 'sendEmail']);
    api.getEmailAvailability.and.returnValue(of(availability()));
    await TestBed.configureTestingModule({
      imports: [AdminSendEmailComponent],
      providers: [{ provide: AdminApiService, useValue: api }]
    }).compileComponents();
  });

  function create(): void {
    fixture = TestBed.createComponent(AdminSendEmailComponent);
    fixture.componentRef.setInput('userId', 'u-1');
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const buttons = () => Array.from(element.querySelectorAll<HTMLButtonElement>('button.send'));
  const row = (index: number) => element.querySelectorAll('.send-row')[index] as HTMLElement;
  const status = (index: number) => text(row(index).querySelector('[role="status"]'));

  function click(index: number): void {
    buttons()[index].click();
    fixture.detectChanges();
  }

  it('loads availability for the user when it opens and shows three buttons in order', () => {
    create();

    expect(api.getEmailAvailability).toHaveBeenCalledOnceWith('u-1');
    expect(buttons().map((button) => text(button))).toEqual(['Training reminder', 'Goal reached', 'Weekly report']);
    expect(buttons().every((button) => !button.disabled)).toBeTrue();
    expect(element.querySelector('.reason')).toBeNull();
  });

  it('keeps the buttons disabled and shows a placeholder while availability loads', () => {
    const pending = new Subject<EmailKindAvailability[]>();
    api.getEmailAvailability.and.returnValue(pending);
    create();

    expect(buttons().every((button) => button.disabled)).toBeTrue();
    expect(element.querySelector('.send-list')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelectorAll('.skeleton').length).toBe(3);

    pending.next(availability());
    fixture.detectChanges();
    expect(element.querySelectorAll('.skeleton').length).toBe(0);
  });

  it('disables a kind that cannot be sent and writes its reason beside it', () => {
    api.getEmailAvailability.and.returnValue(
      of(availability({ GOAL_REACHED: { available: false, reason: 'GOAL_NOT_REACHED', message: 'The weight goal is not reached yet.' } }))
    );
    create();

    const goal = buttons()[1];
    const reason = row(1).querySelector('.reason');
    expect(goal.disabled).toBeTrue();
    expect(text(reason)).toBe('The weight goal is not reached yet.');
    expect(goal.getAttribute('aria-describedby')).toBe(reason?.id ?? 'missing');
    expect(goal.getAttribute('title')).toBeNull();
    expect(buttons()[0].disabled).toBeFalse();
  });

  it('draws all three as disabled when the user has email notifications off, with the reason beside each', () => {
    const off = { available: false, reason: 'NOTIFICATIONS_OFF', message: 'This user has email notifications off.' };
    api.getEmailAvailability.and.returnValue(of(availability({ TRAINING_REMINDER: off, GOAL_REACHED: off, WEEKLY_REPORT: off })));
    create();

    buttons().forEach((button, index) => {
      expect(button.disabled).toBeTrue();
      expect(button.hasAttribute('disabled')).toBeTrue();
      expect(getComputedStyle(button).cursor).toBe('not-allowed');
      expect(text(row(index).querySelector('.reason'))).toBe('This user has email notifications off.');
    });
  });

  it('keeps the pointer cursor on a button that can be pressed', () => {
    create();

    expect(getComputedStyle(buttons()[0]).cursor).toBe('pointer');
  });

  it('shows Sending... on the pressed button and disables all three while it waits', () => {
    const request = new Subject<EmailSendResult>();
    api.sendEmail.and.returnValue(request);
    create();

    click(0);

    expect(api.sendEmail).toHaveBeenCalledOnceWith('u-1', 'TRAINING_REMINDER');
    expect(text(buttons()[0])).toBe('Sending...');
    expect(buttons()[0].getAttribute('aria-busy')).toBe('true');
    expect(buttons().every((button) => button.disabled)).toBeTrue();

    request.next({ kind: 'TRAINING_REMINDER', outcome: 'SENT' });
    request.complete();
    fixture.detectChanges();

    expect(text(buttons()[0])).toBe('Training reminder');
    expect(buttons()[0].disabled).toBeFalse();
  });

  it('reports each outcome inline and reloads availability after the send', () => {
    create();
    const cases: [number, EmailSendResult, string][] = [
      [0, { kind: 'TRAINING_REMINDER', outcome: 'SENT' }, 'Sent.'],
      [1, { kind: 'GOAL_REACHED', outcome: 'RETRYING' }, 'SES refused it; it will retry within minutes.'],
      [2, { kind: 'WEEKLY_REPORT', outcome: 'DROPPED' }, "Not sent: the user's settings changed."]
    ];

    for (const [index, result, message] of cases) {
      api.sendEmail.and.returnValue(of(result));
      click(index);
      expect(status(index)).toBe(message);
    }
    expect(api.getEmailAvailability).toHaveBeenCalledTimes(4);
  });

  it('shows the service sentence for a 409 and reloads availability', () => {
    api.sendEmail.and.returnValue(throwError(() => apiError(409, 'EMAIL_OFF', 'The user has turned email off.')));
    create();
    api.getEmailAvailability.and.returnValue(
      of(availability({ WEEKLY_REPORT: { available: false, reason: 'EMAIL_OFF', message: 'The user has turned email off.' } }))
    );

    click(2);

    expect(status(2)).toBe('The user has turned email off.');
    expect(api.getEmailAvailability).toHaveBeenCalledTimes(2);
    expect(buttons()[2].disabled).toBeTrue();
  });

  it('shows the service sentence for a 429, with a fallback when the body has none', () => {
    api.sendEmail.and.returnValue(throwError(() => apiError(429, 'ADMIN_EMAIL_LIMIT', 'You can send 10 emails an hour.')));
    create();
    click(0);
    expect(status(0)).toBe('You can send 10 emails an hour.');

    expect(sendErrorMessage(apiError(429, 'ADMIN_EMAIL_LIMIT'))).toBe('You have sent the most emails allowed this hour. Try again later.');
    expect(sendErrorMessage(apiError(409, 'NO_RECAP', '  '))).toBe('This email cannot be sent to this user now.');
    expect(sendErrorMessage(new HttpErrorResponse({ status: 0 }))).toBe('FitSync could not be reached. Nothing was sent.');
    expect(sendErrorMessage(new HttpErrorResponse({ status: 500, error: 'stack trace' }))).toBe('Nothing was sent. Try again.');
  });

  it('shows the 404 sentence when a send finds no user', () => {
    api.sendEmail.and.returnValue(throwError(() => apiError(404, 'USER_NOT_FOUND')));
    create();

    click(1);

    expect(status(1)).toBe('This user has no notification record yet.');
  });

  it('says the user has no notification record and disables all three when availability is a 404', () => {
    api.getEmailAvailability.and.returnValue(throwError(() => apiError(404, 'USER_NOT_FOUND', 'User not found')));
    create();

    expect(text(element.querySelector('.notice'))).toBe('This user has no notification record yet.');
    expect(buttons().length).toBe(3);
    expect(buttons().every((button) => button.disabled)).toBeTrue();
  });

  it('offers a retry when availability fails for another reason', () => {
    api.getEmailAvailability.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    create();

    expect(text(element.querySelector('.notice'))).toBe('The emails that can be sent could not be loaded.');
    expect(buttons().every((button) => button.disabled)).toBeTrue();

    api.getEmailAvailability.and.returnValue(of(availability()));
    (element.querySelector('button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelector('.notice')).toBeNull();
    expect(buttons().every((button) => !button.disabled)).toBeTrue();
  });

  it('never shows or asks for an email address', () => {
    api.sendEmail.and.returnValue(of({ kind: 'TRAINING_REMINDER', outcome: 'SENT' }));
    create();
    click(0);

    expect(element.querySelector('input')).toBeNull();
    expect(element.textContent).not.toContain('@');
    expect(element.textContent?.toLowerCase()).not.toContain('email address');
  });

  it('uses no red danger styling', () => {
    create();

    expect(element.querySelector('.danger, .button.danger')).toBeNull();
  });
});
