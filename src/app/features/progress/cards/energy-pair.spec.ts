import { lay } from './energy-pair.component';

describe('the energy bar labels', () => {
  const part = (key: string, label: string, value: number, percent: number) => ({ key, label, value, percent, showLabel: true });

  it('names a wide segment, shows only the figure in a narrow one and nothing in a very narrow one, keeping the title', () => {
    const [wide, narrow, tiny] = lay([part('breakfast', 'Breakfast', 381, 40), part('lunch', 'Lunch', 120, 10), part('snack', 'Snacks', 30, 3)], 400);
    expect(wide.text).toBe('Breakfast 381');
    expect(narrow.text).toBe('120');
    expect(tiny.text).toBe('');
    expect(tiny.title).toBe('Snacks 30');
    expect(narrow.title).toBe('Lunch 120');
  });
});
