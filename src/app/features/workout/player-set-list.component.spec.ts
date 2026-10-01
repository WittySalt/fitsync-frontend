import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerSetListComponent } from './player-set-list.component';
import { PlayerSet, SetTarget } from './player-targets';

const target = (values: Partial<SetTarget>): SetTarget => ({
  reps: null,
  weightKg: null,
  durationSeconds: null,
  distanceKm: null,
  restSeconds: null,
  ...values
});

describe('PlayerSetListComponent', () => {
  let fixture: ComponentFixture<PlayerSetListComponent>;

  function lines(sets: PlayerSet[]): string[] {
    fixture.componentRef.setInput('sets', sets);
    fixture.detectChanges();
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('.values')].map((el) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
  }

  const set = (planned: SetTarget | null, logged: SetTarget | null): PlayerSet => ({
    setNumber: 1,
    target: planned,
    logged,
    skipped: false
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PlayerSetListComponent] }).compileComponents();
    fixture = TestBed.createComponent(PlayerSetListComponent);
  });

  it('shows the values once, with the done mark, when the set was done as planned', () => {
    const [line] = lines([set(target({ reps: 10, weightKg: 20 }), target({ reps: 10, weightKg: 20 }))]);

    expect(line).toBe('10 × 20 kg');
    expect((fixture.nativeElement as HTMLElement).querySelector('.mark')?.getAttribute('aria-label')).toBe('Done');
  });

  it('compares the numbers, so 10 and 10.0 are the same', () => {
    expect(lines([set(target({ reps: 10, weightKg: 20 }), target({ reps: 10.0, weightKg: 20.0 }))])).toEqual(['10 × 20 kg']);
  });

  it('shows planned and done when the reps differ', () => {
    expect(lines([set(target({ reps: 10, weightKg: 20 }), target({ reps: 8, weightKg: 20 }))])).toEqual([
      'planned 10 × 20 kg, did 8 × 20 kg'
    ]);
  });

  it('shows planned and done when the weight differs', () => {
    expect(lines([set(target({ reps: 10, weightKg: 20 }), target({ reps: 10, weightKg: 22.5 }))])).toEqual([
      'planned 10 × 20 kg, did 10 × 22.5 kg'
    ]);
  });

  it('shows what was logged when there was no plan for the set', () => {
    expect(lines([set(null, target({ reps: 12, weightKg: 15 }))])).toEqual(['12 × 15 kg']);
  });

  it('shows an open set by its plan and a skipped one as skipped', () => {
    expect(lines([set(target({ reps: 10 }), null)])).toEqual(['10 reps']);
    expect(lines([{ setNumber: 1, target: target({ reps: 10 }), logged: null, skipped: true }])).toEqual(['Skipped']);
  });

  describe('when rows can be edited', () => {
    const rows = (): HTMLButtonElement[] =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.row')];

    function mount(sets: PlayerSet[], editable = true): void {
      fixture.componentRef.setInput('sets', sets);
      fixture.componentRef.setInput('editable', editable);
      fixture.detectChanges();
    }

    it('turns a done row and a skipped row into buttons with a full accessible name, and an open row stays plain', () => {
      mount([
        { setNumber: 1, target: target({ reps: 10, weightKg: 20 }), logged: target({ reps: 10, weightKg: 20 }), skipped: false },
        { setNumber: 2, target: target({ reps: 10 }), logged: null, skipped: true },
        { setNumber: 3, target: target({ durationSeconds: 45 }), logged: target({ durationSeconds: 45 }), skipped: false },
        { setNumber: 4, target: target({ reps: 10 }), logged: null, skipped: false }
      ]);

      expect(rows().map((row) => row.getAttribute('aria-label'))).toEqual([
        'Set 1, 10 reps at 20 kg, done. Edit',
        'Set 2, skipped. Edit',
        'Set 3, 45 sec, done. Edit'
      ]);
      expect((fixture.nativeElement as HTMLElement).querySelectorAll('li').length).toBe(4);
      expect(rows().every((row) => row.querySelector('.pencil'))).toBeTrue();
    });

    it('says which set was asked for when a row is pressed', () => {
      const asked: number[] = [];
      fixture.componentInstance.edit.subscribe((setNumber) => asked.push(setNumber));
      mount([{ setNumber: 2, target: null, logged: null, skipped: true }]);

      rows()[0].click();

      expect(asked).toEqual([2]);
    });

    it('shows no buttons when editing is not allowed', () => {
      mount([{ setNumber: 1, target: target({ reps: 10 }), logged: target({ reps: 10 }), skipped: false }], false);

      expect(rows().length).toBe(0);
    });
  });
});
