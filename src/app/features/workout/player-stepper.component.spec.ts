import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayerStepperComponent } from './player-stepper.component';

describe('PlayerStepperComponent', () => {
  let fixture: ComponentFixture<PlayerStepperComponent>;

  function mount(inputs: Record<string, unknown>): void {
    fixture = TestBed.createComponent(PlayerStepperComponent);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const press = (label: string) => {
    root().querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click();
    fixture.detectChanges();
  };
  const shown = () => root().querySelector('.value')?.textContent?.trim();

  beforeEach(() => TestBed.configureTestingModule({ imports: [PlayerStepperComponent] }));

  it('goes up and down by one for reps', () => {
    mount({ label: 'Reps', value: 10 });

    press('More reps');
    press('More reps');
    press('Less reps');

    expect(fixture.componentInstance.value()).toBe(11);
    expect(shown()).toBe('11');
  });

  it('goes by 2.5 for weight without drifting', () => {
    mount({ label: 'Weight', unit: 'kg', step: 2.5, value: 20 });

    press('More weight');
    expect(shown()).toBe('22.5');
    press('More weight');
    press('Less weight');
    press('Less weight');
    press('Less weight');

    expect(fixture.componentInstance.value()).toBe(17.5);
    expect(root().querySelector('.title')?.textContent).toContain('Weight (kg)');
  });

  it('shows seconds as minutes and seconds in steps of five', () => {
    mount({ label: 'Time', format: 'clock', step: 5, min: 5, value: 45 });

    expect(shown()).toBe('0:45');
    press('More time');
    expect(shown()).toBe('0:50');
    press('More time');
    press('More time');
    expect(shown()).toBe('1:00');
  });

  it('stops at its limits and disables the button there', () => {
    mount({ label: 'Reps', value: 1, min: 1, max: 2 });

    expect(root().querySelector<HTMLButtonElement>('[aria-label="Less reps"]')?.disabled).toBeTrue();
    press('More reps');
    expect(root().querySelector<HTMLButtonElement>('[aria-label="More reps"]')?.disabled).toBeTrue();
    expect(fixture.componentInstance.value()).toBe(2);
  });
});
