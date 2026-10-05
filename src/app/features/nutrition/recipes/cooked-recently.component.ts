import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { RecipeCoverComponent } from './recipe-cover.component';
import { cookedWhen } from './recipes-figures';
import { RecipeCard } from './recipes.models';
import { RecipesService } from './recipes.service';

const SHOWN = 6;

/**
 * "Cooked recently": the recipes the person finished cooking lately, newest first, from
 * scope=recent. The row is a shortcut, so it stays out of the way: nothing shows while it loads,
 * when the list is empty or when it fails.
 */
@Component({
  selector: 'app-cooked-recently',
  imports: [RecipeCoverComponent, RouterLink],
  template: `
    @if (items().length > 0) {
      <section aria-labelledby="cooked-recently-title">
        <h2 id="cooked-recently-title">Cooked recently</h2>
        <ul>
          @for (card of items(); track card.id) {
            <li>
              <a [routerLink]="['/nutrition/recipes', card.id]">
                <app-recipe-cover [imageUrl]="card.imageUrl" [groups]="card.topFoodGroups" [height]="84" [radius]="12" [glyph]="20" />
                <strong>{{ card.name }}</strong>
                <span>{{ when(card) }}</span>
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styleUrl: './cooked-recently.component.scss'
})
export class CookedRecentlyComponent {
  private readonly service = inject(RecipesService);

  protected readonly items = signal<RecipeCard[]>([]);

  constructor() {
    this.service
      .list({ scope: 'recent', size: SHOWN })
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (page) => this.items.set(page.items), error: () => this.items.set([]) });
  }

  protected when(card: RecipeCard): string {
    return cookedWhen(card.lastCookedAt, new Date(), card.lastActivity === 'LOGGED' ? 'Logged' : 'Cooked');
  }
}
