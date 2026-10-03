import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SECTIONS, SectionId } from './page-head';

/**
 * The contents of the page (spec 1.3): Goal, Training and Food. As a row it sits under the chips and
 * sticks under the top bar on phones; as a rail it stands at the left of the content once the answer
 * has scrolled out. Neither writes to the address bar.
 */
@Component({
  selector: 'app-contents-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [class]="variant()" aria-label="Sections of Progress">
      @for (section of sections; track section.id) {
        <a
          [href]="'#progress-' + section.id"
          [class.current]="active() === section.id"
          [attr.aria-current]="active() === section.id ? 'location' : null"
          (click)="choose($event, section.id)"
          >{{ section.label }}</a
        >
      }
    </nav>
  `,
  styles: `
    :host { display: block; }
    nav { display: flex; }
    a { font-size: var(--pg-control); font-weight: 500; color: var(--text-secondary); text-decoration: none; }
    a:hover { color: var(--text-primary); }
    a:focus-visible { outline: 2px solid var(--border-accent); outline-offset: 3px; border-radius: 4px; }
    .row { gap: 28px; align-items: center; }
    .row a.current { color: var(--text-primary); }
    .rail { flex-direction: column; gap: 14px; }
    .rail a { padding-left: 12px; border-left: 2px solid transparent; }
    .rail a.current { font-weight: 600; color: var(--text-primary); border-left-color: var(--text-primary); }
  `
})
export class ContentsNavComponent {
  readonly variant = input<'row' | 'rail'>('row');
  readonly active = input<SectionId>('goal');
  readonly chosen = output<SectionId>();

  protected readonly sections = SECTIONS;

  protected choose(event: Event, id: SectionId): void {
    event.preventDefault();
    this.chosen.emit(id);
  }
}
