import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { AuthService } from '../../core/auth/auth.service';
import { PrivacyPage } from './privacy.page';

describe('PrivacyPage', () => {
  describe('route', () => {
    let authService: jasmine.SpyObj<AuthService>;

    beforeEach(() => {
      // A visitor with no session: every guarded route would send them to the sign-in page.
      authService = jasmine.createSpyObj<AuthService>('AuthService', ['ensureSession', 'isAdmin']);
      TestBed.configureTestingModule({
        providers: [provideRouter(routes), { provide: AuthService, useValue: authService }]
      });
    });

    it('is public: no guard sits on /privacy', () => {
      const privacy = routes.find((route) => route.path === 'privacy');

      expect(privacy).toBeDefined();
      expect(privacy?.canActivate).toBeUndefined();
      expect(privacy?.canMatch).toBeUndefined();
    });

    it('opens for a visitor who is not signed in', async () => {
      const harness = await RouterTestingHarness.create();

      const page = await harness.navigateByUrl('/privacy', PrivacyPage);

      expect(page).toBeInstanceOf(PrivacyPage);
      expect(authService.ensureSession).not.toHaveBeenCalled();
      expect(harness.routeNativeElement?.textContent).toContain('How FitSync handles your data');
    });
  });

  describe('content', () => {
    let element: HTMLElement;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [PrivacyPage], providers: [provideRouter([])] });
      const fixture = TestBed.createComponent(PrivacyPage);
      fixture.detectChanges();
      element = fixture.nativeElement as HTMLElement;
    });

    it('covers every topic the notice promises, in order', () => {
      const headings = Array.from(element.querySelectorAll('section h2')).map((node) => node.textContent?.trim());

      expect(headings).toEqual([
        'Who processes your data',
        'What we collect and why',
        'Health data and your consent',
        'Where your data is stored',
        'The AI coach',
        'Emails',
        'How long we keep it',
        'Your rights',
        'Other services the app uses',
        'Contact'
      ]);
    });

    it('states the facts the system works by', () => {
      const text = (element.textContent ?? '').replace(/\s+/g, ' ');

      expect(text).toContain('Asia Pacific (Singapore) region');
      expect(text).toContain('Amazon Bedrock');
      expect(text).toContain('outside Singapore');
      expect(text).toContain('The questions you ask the coach and the data it reads are processed by Amazon Bedrock and may be processed outside Singapore.');
      expect(text).toContain('Withdrawing consent stops the coach from using your health answers');
      expect(text).toContain('deleting your account erases everything');
      expect(text).toContain('download it as one JSON file');
      expect(text).toContain('your coach conversations');
      expect(text).toContain('Email notifications are opt-in');
      expect(text).toContain('30 days');
      expect(text).toContain('Database backups are kept for 7 days');
      expect(text).toContain('Open Food Facts');
      expect(text).toContain('USDA FoodData Central');
      expect(text).toContain('TheMealDB');
      expect(text).toContain("Google's favicon service");
    });

    it('gives a contact address as a mail link', () => {
      const mail = element.querySelector<HTMLAnchorElement>('#contact a');

      expect(mail?.getAttribute('href')).toBe('mailto:privacy@fitsyncapp.click');
    });

    it('scrolls to a section from the contents without leaving the page', () => {
      const target = element.querySelector<HTMLElement>('#rights');
      const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
      document.body.appendChild(element);

      const link = Array.from(element.querySelectorAll<HTMLAnchorElement>('.contents a')).find(
        (anchor) => anchor.textContent?.trim() === 'Your rights'
      );
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link?.dispatchEvent(event);

      expect(event.defaultPrevented).toBeTrue();
      expect(scroll).toHaveBeenCalled();
      expect(target).not.toBeNull();
      element.remove();
    });
  });
});
