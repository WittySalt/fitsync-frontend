import { Component, computed, input, output } from '@angular/core';

/** A page number, or a gap between page numbers. Pages are zero-based. */
export type PagerItem = number | 'gap';

/**
 * The page buttons to show: every page up to seven, otherwise the first, the last, the current one
 * and its neighbours, with a gap where pages are left out. Always seven slots, so the row keeps its width.
 */
export function pagerItems(page: number, totalPages: number): PagerItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: Math.max(totalPages, 0) }, (_, index) => index);
  }
  const last = totalPages - 1;
  if (page <= 3) {
    return [0, 1, 2, 3, 4, 'gap', last];
  }
  if (page >= last - 3) {
    return [0, 'gap', last - 4, last - 3, last - 2, last - 1, last];
  }
  return [0, 'gap', page - 1, page, page + 1, 'gap', last];
}

/**
 * Paging for a list: how many items in all, how many to show per page, the page buttons, and a
 * box to go to any page when there are too many pages to show them all.
 */
@Component({
  selector: 'app-pager',
  template: `
    <nav class="pager" [attr.aria-label]="label()">
      <div class="summary">
        <span class="total">{{ total() }} {{ unit() }}</span>
        @if (pageSizes().length > 1) {
          <label class="size">
            <span>Show</span>
            <select [value]="pageSize()" [disabled]="disabled()" (change)="onSize($event)">
              @for (size of pageSizes(); track size) {
                <option [value]="size" [selected]="size === pageSize()">{{ size }}</option>
              }
            </select>
          </label>
        }
      </div>
      @if (totalPages() > 1) {
        <div class="pages">
          <button class="step prev" type="button" [disabled]="disabled() || page() <= 0" (click)="go(page() - 1)">Previous</button>
          <ol>
            @for (item of items(); track $index) {
              <li>
                @if (item === 'gap') {
                  <span class="gap" aria-hidden="true">…</span>
                } @else {
                  <button
                    class="number"
                    type="button"
                    [class.current]="item === page()"
                    [attr.aria-current]="item === page() ? 'page' : null"
                    [attr.aria-label]="'Page ' + (item + 1)"
                    [disabled]="disabled()"
                    (click)="go(item)"
                  >{{ item + 1 }}</button>
                }
              </li>
            }
          </ol>
          <button class="step next" type="button" [disabled]="disabled() || page() + 1 >= totalPages()" (click)="go(page() + 1)">Next</button>
          @if (totalPages() > 7) {
            <label class="jump">
              <span>Go to</span>
              <input
                type="number"
                inputmode="numeric"
                aria-label="Go to page"
                min="1"
                [max]="totalPages()"
                [placeholder]="page() + 1"
                [disabled]="disabled()"
                (keydown.enter)="onJump($event)"
                (change)="onJump($event)"
              />
            </label>
          }
        </div>
      }
    </nav>
  `,
  styleUrl: './pager.component.scss'
})
export class PagerComponent {
  /** The current page, zero-based. */
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly total = input.required<number>();
  /** What the list holds, in the plural: "sessions", "exercises". */
  readonly unit = input('items');
  readonly label = input('Pages');
  readonly pageSize = input(10);
  readonly pageSizes = input<readonly number[]>([]);
  readonly disabled = input(false);
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly items = computed(() => pagerItems(this.page(), this.totalPages()));

  protected go(page: number): void {
    const bounded = Math.min(Math.max(page, 0), this.totalPages() - 1);
    if (bounded !== this.page()) {
      this.pageChange.emit(bounded);
    }
  }

  protected onSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (size !== this.pageSize() && this.pageSizes().includes(size)) {
      this.pageSizeChange.emit(size);
    }
  }

  protected onJump(event: Event): void {
    const box = event.target as HTMLInputElement;
    const typed = Number.parseInt(box.value, 10);
    box.value = '';
    if (Number.isFinite(typed)) {
      this.go(typed - 1);
    }
  }
}
