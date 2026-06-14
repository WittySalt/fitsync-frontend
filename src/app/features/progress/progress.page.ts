import { Component } from '@angular/core';

@Component({
  selector: 'app-progress-page',
  imports: [],
  templateUrl: './progress.page.html',
  styleUrl: './progress.page.scss'
})
export class ProgressPage {
  readonly points = [42, 38, 44, 36, 32, 28, 24];
}

