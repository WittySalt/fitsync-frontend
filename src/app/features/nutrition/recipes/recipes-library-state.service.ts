import { Injectable, inject } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface LibrarySnapshot {
  scope: 'library' | 'mine';
  q: string;
  category: string | null;
  diet: 'VEGETARIAN' | 'VEGAN' | null;
  saved: boolean;
  highProtein: boolean;
  page: number;
  /** How far the page was scrolled when the cook left it, in pixels. */
  scrollY: number;
}

const RECIPE_AREA = '/nutrition/recipes';
const NUTRITION = '/nutrition';

/**
 * Remembers where the person was in the library (search, filters, page, scroll) so that coming back
 * from a recipe, the editor or cook mode with a "Recipes" link or the browser's Back button finds
 * the list as it was. The list keeps its latest state here; the state is armed when a navigation
 * goes into the recipe pages, and used once by the next list that opens. Leaving the Nutrition
 * pages drops it, so a later visit starts fresh.
 */
@Injectable({ providedIn: 'root' })
export class RecipesLibraryState {
  private readonly router = inject(Router);
  private kept: LibrarySnapshot | null = null;
  private armed: LibrarySnapshot | null = null;

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationStart => event instanceof NavigationStart)).subscribe((event) => {
      const from = this.router.url;
      if (event.url.startsWith(RECIPE_AREA)) {
        // Only the list itself knows its scroll position; later hops (recipe to cook) keep what was armed.
        if (this.kept && from.startsWith(NUTRITION) && !from.startsWith(RECIPE_AREA)) {
          this.armed = { ...this.kept, scrollY: typeof window === 'undefined' ? 0 : window.scrollY };
        }
      } else if (!event.url.startsWith(NUTRITION)) {
        this.armed = null;
        this.kept = null;
      }
    });
  }

  /** The list calls this whenever its search, filters or page change. */
  keep(snapshot: Omit<LibrarySnapshot, 'scrollY'>): void {
    this.kept = { ...snapshot, scrollY: 0 };
  }

  /** The state to come back to, once, for the list of this scope; null when there is none. */
  take(scope: LibrarySnapshot['scope']): LibrarySnapshot | null {
    const found = this.armed?.scope === scope ? this.armed : null;
    if (found) {
      this.armed = null;
    }
    return found;
  }
}
