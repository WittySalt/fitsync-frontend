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

    expect(service.preference()).toBe('dark');
    expect(service.theme()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('persists and applies theme changes', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('dark');

    expect(service.preference()).toBe('dark');
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('fs-theme')).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('toggles the root data-theme attribute', () => {
    const service = TestBed.inject(ThemeService);

    service.toggleTheme();

    expect(service.preference()).toBe('dark');
    expect(service.theme()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('defaults to system preference and follows the OS theme when nothing is persisted', () => {
    matchMediaSpy.and.returnValue({ matches: true } as MediaQueryList);

    const service = TestBed.inject(ThemeService);

    expect(service.preference()).toBe('system');
    expect(service.theme()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('persists system preference without storing a concrete theme', () => {
    const service = TestBed.inject(ThemeService);

    service.setTheme('system');

    expect(service.preference()).toBe('system');
    expect(localStorage.getItem('fs-theme')).toBe('system');
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('updates the applied theme when system color scheme changes', () => {
    const changeListener: { current: EventListener | null } = { current: null };
    const query = {
      matches: false,
      addEventListener: jasmine.createSpy('addEventListener').and.callFake((_event: string, listener: EventListener) => {
        changeListener.current = listener;
      })
    } as unknown as MediaQueryList;
    matchMediaSpy.and.returnValue(query);

    const service = TestBed.inject(ThemeService);
    service.setTheme('system');
    (query as { matches: boolean }).matches = true;
    changeListener.current?.(new Event('change'));

    expect(service.preference()).toBe('system');
    expect(service.theme()).toBe('dark');
    expect(localStorage.getItem('fs-theme')).toBe('system');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });
});
