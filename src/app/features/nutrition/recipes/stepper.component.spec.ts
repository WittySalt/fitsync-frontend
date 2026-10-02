import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { StepperComponent } from './stepper.component';

@Component({
  imports: [StepperComponent],
  template: `<app-stepper downLabel="Fewer" upLabel="More" [canDown]="canDown" [canUp]="canUp" (down)="log.push('down')" (up)="log.push('up')">3 of 4</app-stepper>`
})
class HostComponent {
  canDown = true;
  canUp = true;
  log: string[] = [];
}

describe('StepperComponent', () => {
  it('shows what is put in the middle and reports the two buttons', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    expect(el.querySelector('.mid')?.textContent).toBe('3 of 4');
    expect(buttons[0].getAttribute('aria-label')).toBe('Fewer');
    buttons[0].click();
    buttons[1].click();
    expect(fixture.componentInstance.log).toEqual(['down', 'up']);
  });

  it('disables a side that cannot go further', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.canDown = false;
    fixture.detectChanges();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    expect(buttons[0].disabled).toBeTrue();
    expect(buttons[1].disabled).toBeFalse();
  });
});
