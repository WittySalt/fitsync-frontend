import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftSegment } from '../plan-draft';
import { PlanShapeComponent } from './plan-shape.component';
import { SegmentListComponent } from './segment-list.component';
import { repeatRow } from './segment-list-math';
import { defaultSegments, segmentTotal } from './segment-math';
import { blockText, SegmentTimelineComponent } from './segment-timeline.component';

const mins = (list: DraftSegment[]) => list.map((row) => row.minutes);

describe('SegmentTimelineComponent', () => {
  let fixture: ComponentFixture<SegmentTimelineComponent>;
  let emitted: DraftSegment[][];
  const root = () => fixture.nativeElement as HTMLElement;
  const cuts = () => Array.from(root().querySelectorAll<HTMLElement>('.cut'));

  function render(segments: DraftSegment[], width = 600): void {
    fixture = TestBed.createComponent(SegmentTimelineComponent);
    (fixture.nativeElement as HTMLElement).style.display = 'block';
    (fixture.nativeElement as HTMLElement).style.width = `${width}px`;
    fixture.componentRef.setInput('segments', segments);
    emitted = [];
    fixture.componentInstance.segmentsChange.subscribe((next) => emitted.push(next));
    fixture.detectChanges();
    fixture.detectChanges();
  }

  it('writes minutes in a block only when it is at least 36 px wide', () => {
    expect(blockText(36, 5)).toBe('5');
    expect(blockText(35, 5)).toBe('');
    render(defaultSegments(45), 600);
    const texts = Array.from(root().querySelectorAll('.block')).map((block) => block.textContent?.trim());
    expect(texts).toEqual(['5', '35', '5']);
    render(defaultSegments(400), 400);
    expect(Array.from(root().querySelectorAll('.block')).map((block) => block.textContent?.trim())).toEqual(['', '390', '']);
  });

  it('is one 12 px bar in proportion, with a grip between blocks', () => {
    render(defaultSegments(40));
    const blocks = Array.from(root().querySelectorAll<HTMLElement>('.block'));
    expect(blocks.map((block) => block.style.flexGrow)).toEqual(['5', '30', '5']);
    expect(blocks[0].getBoundingClientRect().height).toBe(12);
    expect(cuts().length).toBe(2);
    expect(cuts()[0].getAttribute('role')).toBe('slider');
    expect(cuts()[0].getAttribute('aria-label')).toBe('Move the boundary between Warm-up and Steady');
  });

  it('keeps the grips out of sight at rest', () => {
    render(defaultSegments(40));
    const grip = root().querySelector<HTMLElement>('.grip')!;
    expect(getComputedStyle(grip).opacity).toBe('0');
  });

  it('moves a boundary one minute with the arrow keys, keeping the total', () => {
    render(defaultSegments(40));
    cuts()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(mins(emitted[0])).toEqual([6, 29, 5]);
    cuts()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(mins(emitted[1])).toEqual([5, 29, 6]);
    expect(segmentTotal(emitted[1])).toBe(40);
    cuts()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(emitted.length).toBe(2);
  });

  it('trades minutes between the two neighbours when a grip is dragged', () => {
    render(defaultSegments(40));
    const track = root().querySelector('.track') as HTMLElement;
    const perMinute = (track.getBoundingClientRect().width - 4) / 40;
    const cut = cuts()[0];
    cut.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, pointerId: 1, bubbles: true }));
    cut.dispatchEvent(new PointerEvent('pointermove', { clientX: 100 + perMinute * 4, pointerId: 1, bubbles: true }));
    expect(mins(emitted[emitted.length - 1])).toEqual([9, 26, 5]);
    expect(segmentTotal(emitted[emitted.length - 1])).toBe(40);
    cut.dispatchEvent(new PointerEvent('pointerup', { clientX: 100, pointerId: 1, bubbles: true }));
    cut.dispatchEvent(new PointerEvent('pointermove', { clientX: 500, pointerId: 1, bubbles: true }));
    expect(emitted.length).toBe(1);
  });

  it('draws a repeated pair as one block', () => {
    render(repeatRow(defaultSegments(45), 1, 4));
    expect(root().querySelectorAll('.block').length).toBe(2);
  });
});

describe('SegmentListComponent', () => {
  let fixture: ComponentFixture<SegmentListComponent>;
  let emitted: DraftSegment[][];
  const root = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(root().querySelectorAll<HTMLElement>('.row'));

  function render(segments: DraftSegment[], play = false): void {
    fixture = TestBed.createComponent(SegmentListComponent);
    fixture.componentRef.setInput('segments', segments);
    fixture.componentRef.setInput('play', play);
    emitted = [];
    fixture.componentInstance.segmentsChange.subscribe((next) => emitted.push(next));
    fixture.detectChanges();
  }

  it('has one row per segment in the moves table language, and a dashed add row', () => {
    render(defaultSegments(45));
    expect(rows().length).toBe(3);
    const row = rows()[1];
    expect(row.querySelector('.grip svg circle')).not.toBeNull();
    expect(row.querySelector<HTMLSelectElement>('select')!.value).toBe('STEADY');
    expect(row.querySelector<HTMLInputElement>('input')!.value).toBe('35');
    expect(row.querySelector('.unit')?.textContent).toBe('min');
    expect(row.querySelectorAll('.stepper button').length).toBe(2);
    expect(row.querySelector('.trash')).not.toBeNull();
    expect(root().querySelector('.add button')?.textContent?.trim()).toBe('+ Add segment');
    expect(Array.from(row.querySelectorAll('select option')).map((option) => option.textContent?.trim())).toEqual(['Warm-up', 'Steady', 'Work', 'Easy', 'Cool-down']);
  });

  it('names the steady stretch Play on a sport day', () => {
    render([{ kind: 'STEADY', label: 'Play', minutes: 45, rounds: null }], true);
    expect(Array.from(rows()[0].querySelectorAll('select option')).map((option) => option.textContent?.trim())).toContain('Play');
  });

  it('adds, removes and changes the kind', () => {
    render(defaultSegments(45));
    root().querySelector<HTMLButtonElement>('.add button')!.click();
    expect(emitted[0].length).toBe(4);
    rows()[0].querySelector<HTMLButtonElement>('.trash')!.click();
    expect(emitted[1].map((row) => row.kind)).toEqual(['STEADY', 'COOLDOWN']);
    const select = rows()[0].querySelector<HTMLSelectElement>('select')!;
    select.value = 'WORK';
    select.dispatchEvent(new Event('change'));
    expect(emitted[2][0].kind).toBe('WORK');
  });

  it('changes the minutes by typing and by the steppers', () => {
    render(defaultSegments(45));
    const input = rows()[1].querySelector<HTMLInputElement>('input')!;
    input.value = '20';
    input.dispatchEvent(new Event('change'));
    expect(emitted[0][1].minutes).toBe(20);
    const buttons = rows()[1].querySelectorAll<HTMLButtonElement>('.stepper button');
    buttons[1].click();
    expect(emitted[1][1].minutes).toBe(36);
    buttons[0].click();
    expect(emitted[2][1].minutes).toBe(34);
  });

  it('reorders with the arrow keys on the handle', () => {
    render(defaultSegments(45));
    rows()[0].querySelector<HTMLElement>('.grip')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(emitted[0].map((row) => row.kind)).toEqual(['STEADY', 'WARMUP', 'COOLDOWN']);
    rows()[0].querySelector<HTMLElement>('.grip')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(emitted.length).toBe(1);
  });

  it('reorders by dragging a row onto another', () => {
    render(defaultSegments(45));
    const transfer = new DataTransfer();
    rows()[2].querySelector('.grip')!.dispatchEvent(new DragEvent('dragstart', { dataTransfer: transfer, bubbles: true }));
    rows()[0].dispatchEvent(new DragEvent('dragover', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    rows()[0].dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
    expect(emitted[0].map((row) => row.kind)).toEqual(['COOLDOWN', 'WARMUP', 'STEADY']);
  });

  it('repeats a row with the next, shows the rounds, and stops repeating', () => {
    render(defaultSegments(45));
    rows()[1].querySelector<HTMLButtonElement>('.repeat .quiet')!.click();
    expect(emitted[0][1].rounds).toBe(4);
    render(emitted[0]);
    expect(rows()[1].querySelector('.rounds')?.textContent).toContain('× 4');
    expect(rows()[2].querySelector('.with')?.textContent).toContain('Repeats with the row above');
    rows()[1].querySelectorAll<HTMLButtonElement>('.rounds button')[1].click();
    expect(emitted[0][1].rounds).toBe(5);
    expect(emitted[0][2].rounds).toBe(5);
    rows()[1].querySelector<HTMLButtonElement>('.repeat .quiet')!.click();
    expect(emitted[1].every((row) => row.rounds === null)).toBeTrue();
  });
});

describe('PlanShapeComponent', () => {
  let fixture: ComponentFixture<PlanShapeComponent>;
  const root = () => fixture.nativeElement as HTMLElement;

  function render(segments: DraftSegment[], dayMinutes: number | null): void {
    fixture = TestBed.createComponent(PlanShapeComponent);
    fixture.componentRef.setInput('segments', segments);
    fixture.componentRef.setInput('dayMinutes', dayMinutes);
    fixture.detectChanges();
  }

  it('shows the timeline, the rows and the sum line', () => {
    render(defaultSegments(45), 45);
    expect(root().querySelector('app-segment-timeline')).not.toBeNull();
    expect(root().querySelector('app-segment-list')).not.toBeNull();
    expect(root().querySelector('.sum')?.textContent?.trim()).toBe('Adds up to 45 min');
    expect(root().querySelector('.use')).toBeNull();
  });

  it('offers the sum when the rows do not add up to the day, and sets the duration with it', () => {
    render(defaultSegments(40), 45);
    expect(root().querySelector('.sum span')?.textContent).toBe('Adds up to 40 min; the day is 45 min');
    const chosen: number[] = [];
    fixture.componentInstance.minutesChange.subscribe((value) => chosen.push(value));
    const use = root().querySelector<HTMLButtonElement>('.use')!;
    expect(use.textContent?.trim()).toBe('Use 40 min');
    use.click();
    expect(chosen).toEqual([40]);
  });
});
