import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'fs-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly currentTheme = signal<Theme>(this.resolveInitialTheme());

  readonly theme = this.currentTheme.asReadonly();

  constructor() {
    this.applyTheme(this.currentTheme());
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
    this.persistTheme(theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme() === 'dark' ? 'light' : 'dark');
  }

  private resolveInitialTheme(): Theme {
    const storedTheme = this.readStoredTheme();
    if (storedTheme) {
      return storedTheme;
    }

    return this.prefersDarkTheme() ? 'dark' : 'light';
  }

  private readStoredTheme(): Theme | null {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null;
    } catch {
      return null;
    }
  }

  private persistTheme(theme: Theme): void {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage failures; the active document theme still applies.
    }
  }

  private prefersDarkTheme(): boolean {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  }

  private applyTheme(theme: Theme): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }
}
