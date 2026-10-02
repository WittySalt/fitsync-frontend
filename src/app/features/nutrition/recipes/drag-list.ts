import { signal } from '@angular/core';

/**
 * The drag and drop of a list whose rows can be moved: which row is picked up and which one it is
 * over. Rows are dropped on a row; the list decides what a move does. The keyboard does not use
 * this, it has the Move up and Move down buttons.
 */
export class DragList {
  readonly from = signal<number | null>(null);
  readonly over = signal<number | null>(null);

  start(index: number, event: DragEvent): void {
    this.from.set(index);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
      const row = (event.target as HTMLElement | null)?.closest('li');
      if (row) {
        event.dataTransfer.setDragImage(row, 0, 0);
      }
    }
  }

  hover(index: number, event: DragEvent): void {
    if (this.from() !== null) {
      event.preventDefault();
      this.over.set(index);
    }
  }

  drop(index: number, event: DragEvent, move: (from: number, to: number) => void): void {
    event.preventDefault();
    const from = this.from();
    this.end();
    if (from !== null && from !== index) {
      move(from, index);
    }
  }

  end(): void {
    this.from.set(null);
    this.over.set(null);
  }
}
