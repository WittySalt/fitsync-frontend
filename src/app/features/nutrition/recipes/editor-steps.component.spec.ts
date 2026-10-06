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
    expect(items()[0].querySelector('.found')?.textContent?.trim()).toBe('A 5 min timer was found · Simmer');
    expect(items()[1].querySelector('.found')).toBeNull();
    expect(items()[2].querySelector('.found')?.textContent?.trim()).toBe('A 3 to 4 min timer was found · Fry');
  });

  it('updates the note as the text changes', () => {
    render(['Simmer.']);
    const box = items()[0].querySelector('textarea') as HTMLTextAreaElement;
    box.value = 'Simmer for 10 minutes.';
    box.dispatchEvent(new Event('input'));
    expect(seen).toEqual(['text 0 Simmer for 10 minutes.']);
    fixture.componentRef.setInput('steps', ['Simmer for 10 minutes.']);
    fixture.detectChanges();
    expect(items()[0].querySelector('.found')?.textContent?.trim()).toBe('A 10 min timer was found · Simmer');
  });

  const open = (index: number): void => {
    items()[index].querySelector('textarea')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
  };

  it('keeps a closed row to handle, number, text and remove, with no Move buttons', () => {
    render(['One.', 'Two.']);
    expect(el().querySelectorAll('.up, .down').length).toBe(0);
    const row = items()[0];
    expect(Array.from(row.children).map((child) => child.tagName.toLowerCase() + (child.className ? '.' + String(child.className).split(' ')[0] : ''))).toEqual(['app-reorder', 'span.number', 'div.body', 'button.remove']);
  });

  it('shows the Move buttons inside the row being edited only, and the first cannot go up', () => {
    render(['One.', 'Two.', 'Three.']);
    open(0);
    expect(el().querySelectorAll('.up').length).toBe(1);
    expect(items()[0].querySelector('.body .move')).not.toBeNull();
    expect((items()[0].querySelector('.up') as HTMLButtonElement).disabled).toBeTrue();
    open(2);
    expect(items()[0].querySelector('.move')).toBeNull();
    expect(items()[2].querySelector('.down')?.getAttribute('aria-label')).toBe('Move step 3 down');
    expect((items()[2].querySelector('.down') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('closes the row when the focus leaves it', () => {
    render(['One.', 'Two.']);
    open(0);
    items()[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    fixture.detectChanges();
    expect(el().querySelectorAll('.move').length).toBe(0);
  });

  it('moves a step with the buttons of its open row', () => {
    render(['One.', 'Two.', 'Three.']);
    open(1);
    (items()[1].querySelector('.up') as HTMLButtonElement).click();
    fixture.detectChanges();
    (items()[0].querySelector('.down') as HTMLButtonElement).click();
    expect(seen).toEqual(['move 1 0', 'move 0 1']);
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
