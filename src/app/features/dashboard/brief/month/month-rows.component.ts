import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RowItem, TextRow, isPending } from './month-rows';

/** The lines of the panel's lower part, in the row style of the coach's notices, with a block of
 *  the same height for a line that has not arrived. */
@Component({
  selector: 'app-month-rows',
  standalone: true,
  templateUrl: './month-rows.component.html',
  styleUrl: './month-rows.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonthRowsComponent {
  readonly rows = input.required<readonly RowItem[]>();

  protected asText(row: RowItem): TextRow | null {
    return isPending(row) ? null : row;
  }
}
