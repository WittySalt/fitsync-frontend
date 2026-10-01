import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MuscleGroupCode } from '../../../core/fitsync.models';
import { FocusLineComponent } from './focus-line.component';

const sectorsOf = (...codes: MuscleGroupCode[]): { code: MuscleGroupCode }[] => codes.map((code) => ({ code }));

describe('FocusLineComponent', () => {
  let fixture: ComponentFixture<FocusLineComponent>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function render(focusAreas: string[], sectors: { code: MuscleGroupCode }[]): void {
    fixture.componentRef.setInput('focusAreas', focusAreas);
    fixture.componentRef.setInput('sectors', sectors);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FocusLineComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(FocusLineComponent);
  });

  it('states the fact and offers the link, as the board does', () => {
    render(['UPPER'], sectorsOf('CHEST', 'BACK', 'CORE', 'LEGS'));
    expect(root().querySelector('.focus-text')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Shoulders and arms belong to your upper-body focus and are not in your plan. Add them'
    );
    const link = root().querySelector<HTMLAnchorElement>('a.focus-link');
    expect(link?.textContent?.trim()).toBe('Add them');
    expect(link?.getAttribute('href')).toBe('/workout?tab=plans&edit=active');
  });

  it('says "Add it" for a single group', () => {
    render(['CORE'], sectorsOf('CHEST'));
    expect(root().querySelector('a.focus-link')?.textContent?.trim()).toBe('Add it');
  });

  it('draws a small badge for each named group, and none when the groups are only counted', () => {
    render(['UPPER'], sectorsOf('CHEST', 'BACK'));
    expect(root().querySelectorAll('.focus-badge').length).toBe(2);

    render(['UPPER', 'LOWER'], sectorsOf('CORE'));
    expect(root().querySelectorAll('.focus-badge').length).toBe(0);
    expect(root().querySelector('.focus-text')?.textContent).toContain('Six of your focus areas are not in your plan.');
  });

  it('draws nothing when the wheel has no sector, which means there is no plan to compare with', () => {
    render(['UPPER'], []);
    expect(root().querySelector('.focus-line')).toBeNull();
  });

  it('draws nothing when every focus group has a sector', () => {
    render(['CORE'], sectorsOf('CORE'));
    expect(root().querySelector('.focus-line')).toBeNull();
  });

  it('follows the focus areas when they change', () => {
    render(['CORE'], sectorsOf('CHEST'));
    expect(root().querySelector('.focus-line')).not.toBeNull();
    render([], sectorsOf('CHEST'));
    expect(root().querySelector('.focus-line')).toBeNull();
  });
});
