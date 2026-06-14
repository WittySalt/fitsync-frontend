import { Component } from '@angular/core';
import { inject } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-settings-page',
  imports: [],
  templateUrl: './settings.page.html'
})
export class SettingsPage {
  private readonly authService = inject(AuthService);

  readonly groups = [
    {
      title: 'Profile',
      items: ['Display name', 'Height', 'Activity level', 'Timezone']
    },
    {
      title: 'Training',
      items: ['Fitness level', 'Training location', 'Weekly days', 'Intensity']
    },
    {
      title: 'Nutrition',
      items: ['Dietary pattern', 'Meal frequency', 'Calorie mode', 'Water goal']
    },
    {
      title: 'Notifications',
      items: ['Push', 'Email', 'Workout reminders', 'Quiet hours']
    }
  ];

  logout(): void {
    this.authService.logout();
  }
}
