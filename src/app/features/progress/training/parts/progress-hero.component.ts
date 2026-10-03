import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface HeroTile {
  label: string;
  value: string;
  change: string;
}

/**
 * The green hero of a Progress page: an eyebrow, the period in Fraunces, a note, and up to four
 * figures with their change. Private copy of the shared `app-progress-hero` (contract 5).
 */
@Component({
  selector: 'app-progress-hero',
  template: `
    <section class="hero" [attr.aria-label]="eyebrow() + ', ' + title()">
      <div class="titles">
        <span class="eyebrow">{{ eyebrow() }}</span>
        <strong class="title">{{ title() }}</strong>
        @if (note()) {
          <span class="note">{{ note() }}</span>
        }
      </div>
      <dl class="tiles">
        @for (tile of tiles(); track tile.label) {
          <div class="tile">
            <dt>{{ tile.label }}</dt>
            <dd class="value">{{ tile.value }}</dd>
            @if (tile.change) {
              <dd class="change">{{ tile.change }}</dd>
            }
          </div>
        }
      </dl>
    </section>
  `,
  styleUrl: './progress-hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgressHeroComponent {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly note = input('');
  readonly tiles = input<readonly HeroTile[]>([]);
}
