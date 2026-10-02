import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorStepsComponent } from './editor-steps.component';

describe('EditorStepsComponent', () => {
  let fixture: ComponentFixture<EditorStepsComponent>;
  const seen: string[] = [];

  function render(steps: string[]): void {
    seen.length = 0;
    fixture = TestBed.createComponent(EditorStepsComponent);
    fixture.componentRef.setInput('steps', steps);
    const c = fixture.componentInstance;
    c.moved.subscribe((move) => seen.push(`move ${move.from} ${move.to}`));
    c.changed.subscribe((change) => seen.push(`text ${change.index} ${change.text}`));
    c.removed.subscribe((index) => seen.push(`remove ${index}`));
    c.added.subscribe(() => seen.push('add'));
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const items = () => Array.from(el().querySelectorAll('li'));

  it('shows a box for each step with its number, a handle and a limit of 1000 characters', () => {
    render(['Stir.', 'Serve.']);
    expect(items().length).toBe(2);
    expect(items()[1].querySelector('.number')?.textContent).toBe('2');
    expect(items()[0].querySelector('textarea')?.getAttribute('maxlength')).toBe('1000');
    expect(items()[0].querySelector('textarea')?.getAttribute('aria-label')).toBe('Step 1');
    expect(items()[0].querySelector('app-reorder .grip')).not.toBeNull();
  });

  it('says a timer was found when the text names a time next to a cooking word', () => {
    render(['Stir the oats and milk together and simmer for 5 minutes.', 'Slice the banana on top.', 'Fry for 3-4 mins on each side.']);
    expect(items()[0].querySelector('.found')?.textContent?.trim()).toBe('A 5 min timer was found');
    expect(items()[1].querySelector('.found')).toBeNull();
    expect(items()[2].querySelector('.found')?.textContent?.trim()).toBe('A 3 to 4 min timer was found');
  });

  it('updates the note as the text changes', () => {
    render(['Simmer.']);
    const box = items()[0].querySelector('textarea') as HTMLTextAreaElement;
    box.value = 'Simmer for 10 minutes.';
    box.dispatchEvent(new Event('input'));
    expect(seen).toEqual(['text 0 Simmer for 10 minutes.']);
    fixture.componentRef.setInput('steps', ['Simmer for 10 minutes.']);
    fixture.detectChanges();
    expect(items()[0].querySelector('.found')?.textContent?.trim()).toBe('A 10 min timer was found');
  });

  it('moves a step with the buttons, and the first cannot go up', () => {
    render(['One.', 'Two.', 'Three.']);
    expect((items()[0].querySelector('.up') as HTMLButtonElement).disabled).toBeTrue();
    expect(items()[2].querySelector('.down')?.getAttribute('aria-label')).toBe('Move step 3 down');
    (items()[1].querySelector('.up') as HTMLButtonElement).click();
    (items()[1].querySelector('.down') as HTMLButtonElement).click();
    expect(seen).toEqual(['move 1 0', 'move 1 2']);
  });

  it('moves a step by dragging, and reports add and remove', () => {
    render(['One.', 'Two.']);
    const drag = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: { setData: () => undefined, setDragImage: () => undefined, effectAllowed: '' } });
      return event;
    };
    (items()[1].querySelector('.grip') as HTMLElement).dispatchEvent(drag('dragstart'));
    items()[0].dispatchEvent(drag('dragover'));
    items()[0].dispatchEvent(drag('drop'));
    (el().querySelector('.link') as HTMLButtonElement).click();
    (items()[0].querySelector('.remove') as HTMLButtonElement).click();
    expect(seen).toEqual(['move 1 0', 'add', 'remove 0']);
  });

  it('stops adding at 60 steps and shows what is wrong', () => {
    render(Array.from({ length: 60 }, (_, index) => `Step ${index}`));
    expect((el().querySelector('.link') as HTMLButtonElement).disabled).toBeTrue();
    fixture.componentRef.setInput('error', 'A recipe can have 60 steps at most.');
    fixture.detectChanges();
    expect(el().querySelector('em[role="alert"]')?.textContent).toBe('A recipe can have 60 steps at most.');
  });
});
