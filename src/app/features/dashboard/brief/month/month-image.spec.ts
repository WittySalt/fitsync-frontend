import { buildFigures } from './month-figures';
import { monthInsight, septemberInsight } from './month-fixtures.spec';
import {
  DrawOp,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  MeasureText,
  MonthImageModel,
  buildMonthImageModel,
  layoutMonthImage,
  monthImageFileName,
  monthImageSpan,
  pickImageObservation,
  saveBlobAs,
  wrapText
} from './month-image';
import { MonthObservation } from './month-observations';

// Half an em for every character, whatever the font, so the widths are easy to reason about.
const measure: MeasureText = (text, font) => {
  const size = Number(/(\d+)px/.exec(font)?.[1] ?? 10);
  return text.length * size * 0.5;
};

function observation(id: string, headline: string, note = ''): MonthObservation {
  return { id, headline, note, glyph: [] };
}

function model(overrides: Partial<MonthImageModel> = {}): MonthImageModel {
  return {
    monthName: 'September',
    name: 'Ruixian',
    span: '1 to 30 September 2026',
    figures: [
      { parts: [{ value: '17', unit: '' }], caption: 'sessions' },
      { parts: [{ value: '13', unit: 'h' }, { value: '35', unit: 'min' }], caption: 'trained' },
      { parts: [{ value: '6', unit: '' }], caption: 'personal records' }
    ],
    observation: { headline: 'Six personal records this month.', note: 'On 3, 7, 10 and 14 September.' },
    ...overrides
  };
}

const texts = (ops: DrawOp[]): string[] => ops.flatMap((op) => (op.op === 'text' ? [op.text.trim()] : []));
const textOps = (ops: DrawOp[]): Extract<DrawOp, { op: 'text' }>[] => ops.filter((op): op is Extract<DrawOp, { op: 'text' }> => op.op === 'text');

describe('the file name of the picture', () => {
  it('carries the month that is shown', () => {
    expect(monthImageFileName('2026-09')).toBe('fitsync-2026-09.png');
    expect(monthImageFileName('2027-01')).toBe('fitsync-2027-01.png');
  });
});

describe('the span of dates on the picture', () => {
  it('runs over the whole of a month that is over', () => {
    expect(monthImageSpan(monthInsight({ month: '2026-09', referenceDate: '2026-10-02', firstSessionDate: '2026-03-01' }))).toBe('1 to 30 September 2026');
  });

  it('starts at the first session in the month of the first session', () => {
    expect(monthImageSpan(monthInsight({ month: '2026-09', referenceDate: '2026-10-02', firstSessionDate: '2026-09-13' }))).toBe('13 to 30 September 2026');
  });

  it('ends at the reference date in the running month', () => {
    expect(monthImageSpan(monthInsight({ month: '2026-09', referenceDate: '2026-09-27', firstSessionDate: '2026-08-03' }))).toBe('1 to 27 September 2026');
  });

  it('applies both at once', () => {
    expect(monthImageSpan(monthInsight({ month: '2026-09', referenceDate: '2026-09-27', firstSessionDate: '2026-09-13' }))).toBe('13 to 27 September 2026');
  });

  it('names a single day once', () => {
    expect(monthImageSpan(monthInsight({ month: '2026-09', referenceDate: '2026-09-13', firstSessionDate: '2026-09-13' }))).toBe('13 September 2026');
  });

  it('knows a short month', () => {
    expect(monthImageSpan(monthInsight({ month: '2028-02', referenceDate: '2028-03-02', firstSessionDate: null }))).toBe('1 to 29 February 2028');
  });
});

describe('the observation on the picture', () => {
  it('is the first one', () => {
    const first = observation('records', 'Six personal records this month.');
    expect(pickImageObservation([first, observation('streak', 'x')])).toBe(first);
  });

  it('skips the weight', () => {
    const next = observation('streak', 'Three days in a row was your longest run.');
    expect(pickImageObservation([observation('weight', 'Your weight is down 1.4 kg.'), next])).toBe(next);
  });

  it('is nothing when only the weight is left or nothing was noticed', () => {
    expect(pickImageObservation([observation('weight', 'Your weight is down 1.4 kg.')])).toBeNull();
    expect(pickImageObservation([])).toBeNull();
  });
});

describe('the model of the picture', () => {
  const insight = septemberInsight({ referenceDate: '2026-10-02' });
  const figures = buildFigures({ insight, weeklyTarget: 4, badgeDates: [], badgeState: 'failed' });

  it('takes sessions, time and personal records, and the first observation that is not the weight', () => {
    const built = buildMonthImageModel({
      insight,
      figures,
      observations: [observation('weight', 'Your weight is down 1.4 kg.', 'From 72.5 to 71.1 kg this month.'), observation('records', 'Six personal records this month.', 'On 3 September.')],
      personName: ' Ruixian '
    });
    expect(built.monthName).toBe('September');
    expect(built.name).toBe('Ruixian');
    expect(built.span).toBe('1 to 30 September 2026');
    expect(built.figures.map((figure) => figure.caption)).toEqual(['sessions', 'trained', 'personal records']);
    expect(built.figures[1].parts).toEqual([{ value: '13', unit: 'h' }, { value: '35', unit: 'min' }]);
    expect(built.observation).toEqual({ headline: 'Six personal records this month.', note: 'On 3 September.' });
  });

  it('says personal record in the singular for one', () => {
    const one = buildFigures({ insight: septemberInsight({ totals: { sessions: 3, minutes: 90, records: 1, longestStreakDays: 1 } }), weeklyTarget: null, badgeDates: [], badgeState: 'failed' });
    const built = buildMonthImageModel({ insight, figures: one, observations: [], personName: '' });
    expect(built.figures[2].caption).toBe('personal record');
    expect(built.observation).toBeNull();
  });
});

describe('wrapping text for the picture', () => {
  const font = '400 10px sans-serif';

  it('keeps a short text on one line', () => {
    expect(wrapText('Three words only', font, 200, 2, measure)).toEqual(['Three words only']);
  });

  it('breaks at a space when the line is full', () => {
    expect(wrapText('alpha beta gamma delta', font, 60, 2, measure)).toEqual(['alpha beta', 'gamma delta']);
  });

  it('ends the last line with an ellipsis when the text does not fit in the lines', () => {
    const lines = wrapText('alpha beta gamma delta epsilon zeta', font, 60, 2, measure);
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith('…')).toBeTrue();
    expect(lines.every((line) => measure(line, font) <= 60)).toBeTrue();
  });

  it('cuts a single word that is wider than the line', () => {
    const lines = wrapText('unbreakablewordthatistoolong', font, 60, 2, measure);
    expect(lines.length).toBe(1);
    expect(measure(lines[0], font)).toBeLessThanOrEqual(60);
    expect(lines[0].endsWith('…')).toBeTrue();
  });
});

describe('the layout of the picture', () => {
  it('draws the mark, the title, the month, the name line, the figures and the observation', () => {
    const ops = layoutMonthImage(model(), measure);
    expect(ops[0]).toEqual({ op: 'background', width: IMAGE_WIDTH, height: IMAGE_HEIGHT });
    expect(texts(ops)).toEqual([
      'F',
      'FitSync',
      'MONTH IN REVIEW',
      'September',
      'Ruixian · 1 to 30 September 2026',
      '17',
      'sessions',
      '13',
      'h',
      '35',
      'min',
      'trained',
      '6',
      'personal records',
      'Six personal records this month.',
      'On 3, 7, 10 and 14 September.'
    ]);
  });

  it('keeps everything inside the card, however long the texts are', () => {
    const long = model({
      name: 'A very long display name that goes on and on',
      span: '13 to 27 September 2026',
      observation: {
        headline: 'An observation that is far too long to fit in two lines of the card at this size and goes on and on and on and on and on and on',
        note: 'A note that is also far too long to fit in two lines of the card at this size and goes on and on and on and on and on and on and on and on and on'
      }
    });
    const ops = layoutMonthImage(long, measure);
    for (const op of textOps(ops)) {
      const width = measure(op.text, op.font);
      const left = op.align === 'right' ? op.x - width : op.align === 'center' ? op.x - width / 2 : op.x;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(IMAGE_WIDTH);
      expect(op.y).toBeGreaterThan(0);
      expect(op.y).toBeLessThan(IMAGE_HEIGHT);
    }
    const noteLines = textOps(ops).filter((op) => op.font.startsWith('400 34px') && !op.text.includes('·'));
    expect(noteLines.length).toBe(2);
    const headlineLines = textOps(ops).filter((op) => op.font.startsWith('700 42px'));
    expect(headlineLines.length).toBe(2);
    expect(headlineLines[1].text.endsWith('…')).toBeTrue();
  });

  it('shrinks the name line instead of letting it run off', () => {
    const wide = model({ name: 'Maximilian Alexander von Hohenzollern-Sigmaringen the Third' });
    const line = textOps(layoutMonthImage(wide, measure)).find((op) => op.text.includes('Maximilian'));
    expect(line).toBeDefined();
    const size = Number(/(\d+)px/.exec(line?.font ?? '')?.[1]);
    expect(size).toBeLessThan(34);
    expect(measure(line?.text ?? '', line?.font ?? '')).toBeLessThanOrEqual(IMAGE_WIDTH - 156);
  });

  it('shows only the span when the name is not known', () => {
    const ops = layoutMonthImage(model({ name: '' }), measure);
    expect(texts(ops)).toContain('1 to 30 September 2026');
  });

  it('leaves the observation out and centres the rest when there is none', () => {
    const withNote = layoutMonthImage(model(), measure);
    const without = layoutMonthImage(model({ observation: null }), measure);
    expect(texts(without)).not.toContain('Six personal records this month.');
    expect(without.some((op) => op.op === 'rect' && op.height === 3)).toBeFalse();

    const centre = (ops: DrawOp[]): number => {
      const body = textOps(ops).filter((op) => op.y > 78 + 78);
      return (Math.min(...body.map((op) => op.y)) + Math.max(...body.map((op) => op.y))) / 2;
    };
    const regionCentre = (78 + 78 + (IMAGE_HEIGHT - 78)) / 2;
    expect(Math.abs(centre(without) - regionCentre)).toBeLessThan(60);
    expect(Math.abs(centre(withNote) - regionCentre)).toBeLessThan(80);
  });

  it('gives the three figures one size and puts them side by side', () => {
    const ops = textOps(layoutMonthImage(model(), measure));
    const values = ops.filter((op) => op.font.includes('Fraunces') && ['17', '13', '6'].includes(op.text));
    expect(new Set(values.map((op) => op.font)).size).toBe(1);
    expect(new Set(values.map((op) => op.y)).size).toBe(1);
    expect(values[0].x).toBeLessThan(values[1].x);
    expect(values[1].x).toBeLessThan(values[2].x);
  });

  it('scales the figures down together when one is too wide for its column', () => {
    const wide = model({
      figures: [
        { parts: [{ value: '17', unit: '' }], caption: 'sessions' },
        { parts: [{ value: '123', unit: 'h' }, { value: '45', unit: 'min' }], caption: 'trained' },
        { parts: [{ value: '6', unit: '' }], caption: 'personal records' }
      ]
    });
    const normal = textOps(layoutMonthImage(model(), measure)).find((op) => op.text === '17');
    const scaled = textOps(layoutMonthImage(wide, measure)).find((op) => op.text === '17');
    const size = (font: string | undefined): number => Number(/(\d+)px/.exec(font ?? '')?.[1]);
    expect(size(scaled?.font)).toBeLessThanOrEqual(size(normal?.font));
  });
});

describe('saving the picture', () => {
  it('goes through a temporary link that has the file name and lets the object URL go afterwards', () => {
    jasmine.clock().install();
    try {
      const created = spyOn(URL, 'createObjectURL').and.returnValue('blob:test');
      const revoked = spyOn(URL, 'revokeObjectURL');
      const clicked: { name: string; href: string }[] = [];
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        clicked.push({ name: this.download, href: this.href });
      });

      saveBlobAs(new Blob(['x'], { type: 'image/png' }), 'fitsync-2026-09.png');

      expect(created).toHaveBeenCalledTimes(1);
      expect(clicked).toEqual([{ name: 'fitsync-2026-09.png', href: 'blob:test' }]);
      expect(document.querySelector('a[download]')).toBeNull();
      expect(revoked).not.toHaveBeenCalled();
      jasmine.clock().tick(1000);
      expect(revoked).toHaveBeenCalledOnceWith('blob:test');
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
