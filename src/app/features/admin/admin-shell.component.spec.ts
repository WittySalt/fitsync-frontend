import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AdminShellComponent } from './admin-shell.component';

@Component({ template: '<p class="stub">page</p>' })
class StubPage {}

describe('AdminShellComponent', () => {
  let fixture: ComponentFixture<AdminShellComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [
        provideRouter([
          { path: 'admin/coach-quality', component: StubPage },
          { path: 'admin/catalogue', component: StubPage },
          { path: 'admin/users', component: StubPage },
          { path: 'admin/events', component: StubPage },
          { path: 'dashboard', component: StubPage }
        ])
      ]
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AdminShellComponent);
  });

  async function openAt(url: string): Promise<HTMLElement> {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the four admin links with their targets', async () => {
    const element = await openAt('/admin/coach-quality');

    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.links a'));
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Coach quality', 'Catalogue', 'User data', 'Events']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/coach-quality',
      '/admin/catalogue',
      '/admin/users',
      '/admin/events'
    ]);
    expect(links.every((link) => link.querySelector('svg') !== null)).toBeTrue();
  });

  it('marks only the current page with aria-current', async () => {
    const element = await openAt('/admin/users');

    const current = Array.from(element.querySelectorAll('.links a[aria-current="page"]'));
    expect(current.length).toBe(1);
    expect(current[0].textContent?.trim()).toBe('User data');
    expect(current[0].classList).toContain('active');
  });

  it('moves the active state when the page changes', async () => {
    const element = await openAt('/admin/coach-quality');
    expect(element.querySelector('.links a[aria-current="page"]')?.textContent?.trim()).toBe('Coach quality');

    await router.navigateByUrl('/admin/events');
    fixture.detectChanges();

    expect(element.querySelector('.links a[aria-current="page"]')?.textContent?.trim()).toBe('Events');
  });

  it('links back to the member app', async () => {
    const element = await openAt('/admin/coach-quality');

    const back = element.querySelector<HTMLAnchorElement>('a.back');
    expect(back?.textContent?.trim()).toBe('Back to the app');
    expect(back?.getAttribute('href')).toBe('/dashboard');
  });

  it('names the area and renders the page in the main area', async () => {
    const element = await openAt('/admin/coach-quality');

    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Admin');
    expect(element.querySelector('.brand-text')?.textContent).toContain('FitSync');
    expect(element.querySelector('.brand-text')?.textContent).toContain('Admin');
    expect(element.querySelector('main router-outlet')).not.toBeNull();
  });

  it('does not carry the member navigation', async () => {
    const element = await openAt('/admin/coach-quality');

    expect(element.querySelector('.nav-list')).toBeNull();
    expect(element.querySelector('.bottom-nav')).toBeNull();
    expect(element.textContent).not.toContain('Workout');
    expect(element.textContent).not.toContain('Nutrition');
  });
});
