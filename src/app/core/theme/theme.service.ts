import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

const THEME_STORAGE_KEY = 'fs-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly colorSchemeQuery = this.getColorSchemeQuery();
  private readonly currentPreference = signal<ThemePreference>(this.resolveInitialPreference());
  private readonly currentTheme = signal<Theme>(this.resolveTheme(this.currentPreference()));

  readonly preference = this.currentPreference.asReadonly();
  readonly theme = this.currentTheme.asReadonly();

  constructor() {
    this.applyTheme(this.currentTheme());
    this.bindSystemThemeListener();
  }

  setTheme(preference: ThemePreference): void {
    this.currentPreference.set(preference);
    this.persistTheme(preference);
    this.syncTheme();
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme() === 'dark' ? 'light' : 'dark');
  }

  private resolveInitialPreference(): ThemePreference {
    const storedPreference = this.readStoredTheme();
    if (storedPreference) {
      return storedPreference;
    }

    return 'system';
  }

  private readStoredTheme(): ThemePreference | null {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      return storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system' ? storedTheme : null;
    } catch {
      return null;
    }
  }

  private persistTheme(theme: ThemePreference): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures; the active document theme still applies.
    }
  }

  private resolveTheme(preference: ThemePreference): Theme {
    if (preference !== 'system') {
      return preference;
    }
    return this.prefersDarkTheme() ? 'dark' : 'light';
  }

  private syncTheme(): void {
    const theme = this.resolveTheme(this.currentPreference());
    this.currentTheme.set(theme);
    this.applyTheme(theme);
  }

  private getColorSchemeQuery(): MediaQueryList | null {
    return typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  }

  private prefersDarkTheme(): boolean {
    return this.colorSchemeQuery?.matches ?? false;
  }

  private bindSystemThemeListener(): void {
    const listener = () => {
      if (this.currentPreference() === 'system') {
        this.syncTheme();
      }
    };

    if (this.colorSchemeQuery?.addEventListener) {
      this.colorSchemeQuery.addEventListener('change', listener);
      return;
    }

    this.colorSchemeQuery?.addListener?.(listener);
  }

  private applyTheme(theme: Theme): void {
    this.document.documentElement.dataset['theme'] = theme;
  }
}
