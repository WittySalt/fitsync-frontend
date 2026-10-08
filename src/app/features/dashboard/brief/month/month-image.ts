import { MonthlyTrainingInsight } from '../../../../core/fitsync.models';
import { FigurePart, MonthFigure } from './month-figures';
import { MonthObservation } from './month-observations';
import { daysInMonth, monthNameOf, monthOfDate } from './month-grid';

/** The saved picture is a 4 by 5 card. Every number below is in pixels of that card, and the
 *  sizes are those of the design board's card at 440 px wide, scaled by 1080 / 440. */
export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1350;

const PADDING = 78;
const CONTENT_WIDTH = IMAGE_WIDTH - 2 * PADDING;

// The same families as the app, with the same fallbacks as the tokens file.
const FONT_DISPLAY = '"Fraunces", Georgia, "Times New Roman", serif';
const FONT_SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const COLOR_INK = '#ffffff';
const COLOR_SOFT = '#cbd5e1';
const COLOR_ACCENT = '#4ade80';
const COLOR_MARK = '#16a34a';
const COLOR_RULE = '#334155';

const ELLIPSIS = '…';

export function displayFont(size: number, weight = 600): string {
  return `${weight} ${size}px ${FONT_DISPLAY}`;
}

export function sansFont(size: number, weight = 400): string {
  return `${weight} ${size}px ${FONT_SANS}`;
}

/** What one draw operation says. The card is drawn from a list of these, so the layout can be read
 *  and tested without a canvas. Text sits on its baseline at (x, y). */
export type DrawOp =
  | { op: 'background'; width: number; height: number }
  | { op: 'rect'; x: number; y: number; width: number; height: number; radius: number; fill: string }
  | { op: 'text'; x: number; y: number; text: string; font: string; fill: string; align: 'left' | 'center' | 'right'; letterSpacing: number };

export type MeasureText = (text: string, font: string) => number;

export interface MonthImageFigure {
  parts: FigurePart[];
  caption: string;
}

export interface MonthImageModel {
  monthName: string;
  /** The person's name, empty when the name is not known. */
  name: string;
  /** The span of dates with the year, such as "1 to 30 September 2026". */
  span: string;
  figures: MonthImageFigure[];
  observation: { headline: string; note: string } | null;
}

export interface MonthImageInput {
  insight: MonthlyTrainingInsight;
  /** The six figures of the panel, of which the picture takes three. */
  figures: readonly MonthFigure[];
  observations: readonly MonthObservation[];
  personName: string;
}

/** The name of the file, such as fitsync-2026-09.png. */
export function monthImageFileName(month: string): string {
  return `fitsync-${month}.png`;
}

/** The dates the picture speaks of: the month from its first day, or from the first session in the
 *  month of the first session, to its last day, or to the reference date while it is running. */
export function monthImageSpan(insight: MonthlyTrainingInsight): string {
  const { month, firstSessionDate, referenceDate } = insight;
  const lastDay = daysInMonth(month);
  const start = firstSessionDate && monthOfDate(firstSessionDate) === month ? Number(firstSessionDate.slice(8, 10)) : 1;
  const running = referenceDate && monthOfDate(referenceDate) === month ? Number(referenceDate.slice(8, 10)) : lastDay;
  const end = Math.min(lastDay, Math.max(start, running));
  const year = month.slice(0, 4);
  const name = monthNameOf(month);
  return start === end ? `${start} ${name} ${year}` : `${start} to ${end} ${name} ${year}`;
}

/** The first observation that is not about weight, which does not belong in a picture that is
 *  meant to be shared. */
export function pickImageObservation(observations: readonly MonthObservation[]): MonthObservation | null {
  return observations.find((observation) => observation.id !== 'weight') ?? null;
}

/** Sessions, time trained and personal records, in that order. */
export function buildMonthImageModel(input: MonthImageInput): MonthImageModel {
  const { insight } = input;
  const figures: MonthImageFigure[] = [];
  for (const id of ['sessions', 'time', 'records'] as const) {
    const figure = input.figures.find((entry) => entry.id === id);
    if (figure) {
      figures.push({ parts: figure.parts, caption: figure.caption });
    }
  }
  const observation = pickImageObservation(input.observations);
  return {
    monthName: monthNameOf(insight.month),
    name: input.personName.trim(),
    span: monthImageSpan(insight),
    figures,
    observation: observation ? { headline: observation.headline, note: observation.note } : null
  };
}

/** Cuts a text from the end until it fits with an ellipsis after it. */
export function ellipsize(text: string, font: string, maxWidth: number, measure: MeasureText): string {
  if (measure(text, font) <= maxWidth) {
    return text;
  }
  let cut = text;
  while (cut.length > 0 && measure(`${cut.trimEnd()}${ELLIPSIS}`, font) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}${ELLIPSIS}`;
}

/** Breaks a text into at most `maxLines` lines that fit the width. What does not fit ends the last
 *  line with an ellipsis, and a word wider than a line is cut the same way. */
export function wrapText(text: string, font: string, maxWidth: number, maxLines: number, measure: MeasureText): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let index = 0;
  while (index < words.length && lines.length < maxLines) {
    let line = words[index];
    index += 1;
    while (index < words.length && measure(`${line} ${words[index]}`, font) <= maxWidth) {
      line = `${line} ${words[index]}`;
      index += 1;
    }
    lines.push(line);
  }
  if (index < words.length && lines.length > 0) {
    lines[lines.length - 1] = ellipsize(`${lines[lines.length - 1]} ${words.slice(index).join(' ')}`, font, maxWidth, measure);
  }
  return lines.map((line) => ellipsize(line, font, maxWidth, measure));
}

/** The largest size from `max` down to `min` at which the text fits in one line. */
function fitSize(text: string, maxWidth: number, max: number, min: number, font: (size: number) => string, measure: MeasureText): number {
  let size = max;
  while (size > min && measure(text, font(size)) > maxWidth) {
    size -= 1;
  }
  return size;
}

/** Where the baseline of a line lies, for a line box of the given top and height. */
function baseline(top: number, lineHeight: number, size: number): number {
  return Math.round(top + lineHeight / 2 + size * 0.36);
}

interface Block {
  height: number;
  ops: (top: number) => DrawOp[];
}

const BLOCK_GAP = 110;
const FIGURE_GAP = 29;
const FIGURE_VALUE = 83;
const FIGURE_UNIT = 37;
const FIGURE_CAPTION = 32;

function monthBlock(model: MonthImageModel, measure: MeasureText): Block {
  const monthSize = fitSize(model.monthName, CONTENT_WIDTH, 118, 60, displayFont, measure);
  const monthHeight = Math.round(monthSize * 1.15);
  const line = model.name ? `${model.name} · ${model.span}` : model.span;
  const lineSize = fitSize(line, CONTENT_WIDTH, 34, 22, sansFont, measure);
  const lineHeight = Math.round(lineSize * 1.3);
  return {
    height: monthHeight + 15 + lineHeight,
    ops: (top) => [
      {
        op: 'text',
        x: PADDING,
        y: baseline(top, monthHeight, monthSize),
        text: model.monthName,
        font: displayFont(monthSize),
        fill: COLOR_INK,
        align: 'left',
        letterSpacing: 0
      },
      {
        op: 'text',
        x: PADDING,
        y: baseline(top + monthHeight + 15, lineHeight, lineSize),
        text: ellipsize(line, sansFont(lineSize), CONTENT_WIDTH, measure),
        font: sansFont(lineSize),
        fill: COLOR_SOFT,
        align: 'left',
        letterSpacing: 0
      }
    ]
  };
}

function figureWidth(parts: readonly FigurePart[], scale: number, measure: MeasureText): number {
  const valueFont = displayFont(Math.round(FIGURE_VALUE * scale));
  const unitFont = sansFont(Math.round(FIGURE_UNIT * scale), 500);
  let width = 0;
  parts.forEach((part, index) => {
    width += (index > 0 ? measure(' ', valueFont) : 0) + measure(part.value, valueFont);
    width += part.unit ? measure(` ${part.unit}`, unitFont) : 0;
  });
  return width;
}

function figuresBlock(model: MonthImageModel, measure: MeasureText): Block {
  const columns = Math.max(1, model.figures.length);
  const columnWidth = (CONTENT_WIDTH - FIGURE_GAP * (columns - 1)) / columns;
  // One scale for the three, so that the numbers keep the same height beside each other.
  let scale = 1;
  for (const figure of model.figures) {
    const width = figureWidth(figure.parts, 1, measure);
    if (width > columnWidth) {
      scale = Math.min(scale, columnWidth / width);
    }
  }
  scale = Math.max(scale, 0.5);
  const valueSize = Math.round(FIGURE_VALUE * scale);
  const unitSize = Math.round(FIGURE_UNIT * scale);
  const captionHeight = Math.round(FIGURE_CAPTION * 1.3);
  return {
    height: valueSize + 15 + captionHeight,
    ops: (top) => {
      const ops: DrawOp[] = [];
      model.figures.forEach((figure, column) => {
        let x = PADDING + column * (columnWidth + FIGURE_GAP);
        const y = baseline(top, valueSize, valueSize);
        figure.parts.forEach((part, index) => {
          if (index > 0) {
            x += measure(' ', displayFont(valueSize));
          }
          ops.push({ op: 'text', x: Math.round(x), y, text: part.value, font: displayFont(valueSize), fill: COLOR_INK, align: 'left', letterSpacing: 0 });
          x += measure(part.value, displayFont(valueSize));
          if (part.unit) {
            const unitFont = sansFont(unitSize, 500);
            ops.push({ op: 'text', x: Math.round(x), y, text: ` ${part.unit}`, font: unitFont, fill: COLOR_SOFT, align: 'left', letterSpacing: 0 });
            x += measure(` ${part.unit}`, unitFont);
          }
        });
        ops.push({
          op: 'text',
          x: Math.round(PADDING + column * (columnWidth + FIGURE_GAP)),
          y: baseline(top + valueSize + 15, captionHeight, FIGURE_CAPTION),
          text: ellipsize(figure.caption, sansFont(FIGURE_CAPTION), columnWidth, measure),
          font: sansFont(FIGURE_CAPTION),
          fill: COLOR_SOFT,
          align: 'left',
          letterSpacing: 0
        });
      });
      return ops;
    }
  };
}

const HEADLINE_SIZE = 42;
const NOTE_SIZE = 34;
const HEADLINE_LINE = 57;
const NOTE_LINE = 48;
const RULE_HEIGHT = 3;
const RULE_PADDING = 44;

function observationBlock(observation: { headline: string; note: string }, measure: MeasureText): Block {
  const headline = wrapText(observation.headline, sansFont(HEADLINE_SIZE, 700), CONTENT_WIDTH, 2, measure);
  const note = observation.note ? wrapText(observation.note, sansFont(NOTE_SIZE), CONTENT_WIDTH, 2, measure) : [];
  const height = RULE_HEIGHT + RULE_PADDING + headline.length * HEADLINE_LINE + (note.length ? 12 + note.length * NOTE_LINE : 0);
  return {
    height,
    ops: (top) => {
      const ops: DrawOp[] = [{ op: 'rect', x: PADDING, y: top, width: CONTENT_WIDTH, height: RULE_HEIGHT, radius: 0, fill: COLOR_RULE }];
      let y = top + RULE_HEIGHT + RULE_PADDING;
      for (const line of headline) {
        ops.push({ op: 'text', x: PADDING, y: baseline(y, HEADLINE_LINE, HEADLINE_SIZE), text: line, font: sansFont(HEADLINE_SIZE, 700), fill: COLOR_INK, align: 'left', letterSpacing: 0 });
        y += HEADLINE_LINE;
      }
      y += note.length ? 12 : 0;
      for (const line of note) {
        ops.push({ op: 'text', x: PADDING, y: baseline(y, NOTE_LINE, NOTE_SIZE), text: line, font: sansFont(NOTE_SIZE), fill: COLOR_SOFT, align: 'left', letterSpacing: 0 });
        y += NOTE_LINE;
      }
      return ops;
    }
  };
}

const HEADER_HEIGHT = 78;

function headerOps(): DrawOp[] {
  const centre = PADDING + HEADER_HEIGHT / 2;
  return [
    { op: 'rect', x: PADDING, y: PADDING, width: HEADER_HEIGHT, height: HEADER_HEIGHT, radius: 24, fill: COLOR_MARK },
    { op: 'text', x: centre, y: baseline(PADDING, HEADER_HEIGHT, 37), text: 'F', font: sansFont(37, 700), fill: COLOR_INK, align: 'center', letterSpacing: 0 },
    { op: 'text', x: PADDING + HEADER_HEIGHT + 25, y: baseline(PADDING, HEADER_HEIGHT, 37), text: 'FitSync', font: sansFont(37, 700), fill: COLOR_INK, align: 'left', letterSpacing: 0 },
    {
      op: 'text',
      x: IMAGE_WIDTH - PADDING,
      y: baseline(PADDING, HEADER_HEIGHT, 29),
      text: 'MONTH IN REVIEW',
      font: sansFont(29, 700),
      fill: COLOR_ACCENT,
      align: 'right',
      letterSpacing: 2.9
    }
  ];
}

/** Lays the card out as a list of draw operations: the mark and the title at the top, then the
 *  month, the three figures and the one observation, centred in the room below. Without an
 *  observation the other two are centred on their own. */
export function layoutMonthImage(model: MonthImageModel, measure: MeasureText): DrawOp[] {
  const blocks: Block[] = [monthBlock(model, measure), figuresBlock(model, measure)];
  if (model.observation) {
    blocks.push(observationBlock(model.observation, measure));
  }
  const total = blocks.reduce((sum, block) => sum + block.height, 0) + BLOCK_GAP * (blocks.length - 1);
  const regionTop = PADDING + HEADER_HEIGHT;
  const regionHeight = IMAGE_HEIGHT - PADDING - regionTop;
  let top = regionTop + Math.max(0, Math.round((regionHeight - total) / 2));

  const ops: DrawOp[] = [{ op: 'background', width: IMAGE_WIDTH, height: IMAGE_HEIGHT }, ...headerOps()];
  for (const block of blocks) {
    ops.push(...block.ops(top));
    top += block.height + BLOCK_GAP;
  }
  return ops;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Executes the operations on a canvas context. */
export function drawOps(ctx: CanvasRenderingContext2D, ops: readonly DrawOp[]): void {
  for (const op of ops) {
    if (op.op === 'background') {
      // The board's gradient at 145 degrees, from the dark slate to the dark green in the corner.
      const angle = (145 * Math.PI) / 180;
      const dx = Math.sin(angle);
      const dy = -Math.cos(angle);
      const half = (Math.abs(op.width * dx) + Math.abs(op.height * dy)) / 2;
      const cx = op.width / 2;
      const cy = op.height / 2;
      const gradient = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
      gradient.addColorStop(0, '#0f172a');
      gradient.addColorStop(0.62, '#0f172a');
      gradient.addColorStop(1, '#14532d');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, op.width, op.height);
    } else if (op.op === 'rect') {
      ctx.fillStyle = op.fill;
      if (op.radius > 0) {
        roundedRect(ctx, op.x, op.y, op.width, op.height, op.radius);
        ctx.fill();
      } else {
        ctx.fillRect(op.x, op.y, op.width, op.height);
      }
    } else {
      ctx.font = op.font;
      ctx.fillStyle = op.fill;
      ctx.textAlign = op.align;
      ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${op.letterSpacing}px`;
      }
      ctx.fillText(op.text, op.x, op.y);
    }
  }
}

async function fontsReady(): Promise<void> {
  try {
    const fonts = document.fonts;
    // The weights the picture uses may not have been needed by the page yet, so they are asked for.
    await Promise.all([fonts.load(displayFont(118)), fonts.load(sansFont(37, 700)), fonts.load(sansFont(34))]);
    await fonts.ready;
  } catch {
    // A browser without the font loading API draws with the fallbacks.
  }
}

/** Draws the card on a canvas of its own and returns it as a PNG. Nothing leaves the device. */
export async function renderMonthImage(model: MonthImageModel): Promise<Blob> {
  await fontsReady();
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not available.');
  }
  const measure: MeasureText = (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
  drawOps(ctx, layoutMonthImage(model, measure));
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be encoded.'))), 'image/png');
  });
}

const REVOKE_AFTER_MS = 1000;

/** Hands the file to the browser through a temporary link and lets the object URL go afterwards. */
export function saveBlobAs(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
