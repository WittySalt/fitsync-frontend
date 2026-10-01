import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FoodGlyphComponent } from './food-glyph.component';
import { FoodIconComponent } from './food-icon.component';
import { FoodGroup } from './food-groups';

@Component({
  imports: [FoodIconComponent, FoodGlyphComponent],
  template: `
    <app-food-icon [group]="group" [categoryCode]="category" [size]="40" />
    <app-food-glyph name="PLUS" [size]="14" />
    <app-food-glyph name="NOPE" />
  `
})
class HostComponent {
  group: FoodGroup | null = 'DAIRY';
  category: string | null = null;
}

describe('food icon', () => {
  it('draws the group icon on a tile with the group colour and the size asked for', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const tile: HTMLElement = fixture.nativeElement.querySelector('app-food-icon');
    expect(tile.style.getPropertyValue('--tile')).toBe('var(--food-dairy)');
    expect(tile.style.width).toBe('40px');
    expect(tile.querySelectorAll('svg path, svg circle').length).toBeGreaterThan(0);
    expect(tile.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws fish for seafood', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.group = 'PROTEIN';
    fixture.componentInstance.category = 'SEAFOOD';
    fixture.detectChanges();
    const tile: HTMLElement = fixture.nativeElement.querySelector('app-food-icon');
    expect(tile.querySelector('circle')).not.toBeNull();
  });

  it('keeps a neutral empty tile for a food with no group', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.group = null;
    fixture.detectChanges();
    const tile: HTMLElement = fixture.nativeElement.querySelector('app-food-icon');
    expect(tile.querySelector('svg')).toBeNull();
    expect(tile.style.getPropertyValue('--tile')).toBe('var(--text-secondary)');
  });

  it('draws a glyph at its size and nothing inside for an unknown name', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const glyphs: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll(':scope > app-food-glyph'));
    expect(glyphs[0].querySelector('svg')?.getAttribute('width')).toBe('14');
    expect(glyphs[1].querySelectorAll('path, circle').length).toBe(0);
  });
});
