import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;
  let matchMediaSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.removeItem('fs-theme');
    root.removeAttribute('data-theme');
    matchMediaSpy = spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.removeItem('fs-theme');
    root.removeAttribute('data-theme');
  });

  it('restores a persisted theme and applies it to the document root', () => {
    localStorage.setItem('fs-theme', 'dark');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('persists and applies theme changes', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('dark');

    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('fs-theme')).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles the root data-theme attribute', () => {
    const service = TestBed.inject(ThemeService);

    service.toggleTheme();

    expect(service.theme()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to the OS theme when nothing is persisted', () => {
    matchMediaSpy.and.returnValue({ matches: true } as MediaQueryList);

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });
});
