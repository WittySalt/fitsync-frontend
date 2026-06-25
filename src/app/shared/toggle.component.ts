import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-toggle',
  templateUrl: './toggle.component.html',
  styleUrl: './toggle.component.scss'
})
export class ToggleComponent {
  readonly label = input.required<string>();
  readonly description = input<string | null>(null);
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly checkedChange = output<boolean>();

  onChanged(event: Event): void {
    const control = event.target as HTMLInputElement;
    this.checkedChange.emit(control.checked);
  }
}
