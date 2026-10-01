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
});
