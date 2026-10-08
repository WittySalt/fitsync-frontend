import { daysBetween, formatNumber } from '../../../shared/progress/progress-format';
import { GoalProgress, GoalRoad, OtherGoal } from '../progress-api.models';
import {
  AlsoPill,
  FOUR_WEEKS,
  Span,
  CardHeadline,
  PictureNote,
  alsoPills,
  habitCounts,
  habitEmptyHeadline,
  habitEmptyText,
  habitHeadline,
  habitItems,
  habitShare,
  habitShareLine,
  habitTarget,
  keepHeadline,
  keepShare,
  leadOf,
  roadHeadline,
  roadNote,
  roadOf
} from './goal-road';
import { ReadingLine, goalReadingLines } from './card-readings';
import { StripItem } from './strip-chart.component';

export type GoalPicture = 'ROAD' | 'KEEP' | 'HABIT' | 'NO_DATA' | 'EMPTY';

/** Everything the Goal card draws, worked out from the response so the template only places it. */
export interface GoalView {
  picture: GoalPicture;
  headline: CardHeadline;
  note: PictureNote | null;
  road: GoalRoad | null;
  habit: OtherGoal | null;
  strip: StripItem[];
  stripTarget: string;
  stripShare: string;
  lines: ReadingLine[];
  pills: AlsoPill[];
  /** What a screen reader hears for the picture. */
  label: string;
  /** The sentence shown in place of the picture when a goal has nothing logged yet. */
  empty: string;
}

const EMPTY_HEADLINE: CardHeadline = { figure: 'No goal yet', tail: '', caption: 'Set one in Me' };

function weighIns(goal: GoalProgress, today: string, days: number): { logged: number; days: number } | null {
  const logged = goal.weight.daily.filter((day) => daysBetween(day.date, today) >= 0 && daysBetween(day.date, today) < days).length;
  return logged > 0 ? { logged, days } : null;
}

function habitLines(goal: OtherGoal): ReadingLine[] {
  const line = habitShareLine(goal);
  return line ? [{ ...line, trend: '' }] : [];
}

export function goalCardView(goal: GoalProgress, today: string, span: Span = FOUR_WEEKS): GoalView {
  const lead = leadOf(goal);
  const road = roadOf(goal, today);
  const lines = goalReadingLines(goal, road, span, weighIns(goal, today, span.days));
  const pills = alsoPills(goal, lead);
  const none = { habit: null, strip: [], stripTarget: '', stripShare: '', note: null, road: null, empty: '' };

  if (lead.kind === 'WEIGHT' && road) {
    if (road.direction === 'KEEP' && road.keep) {
      const headline = keepHeadline(road);
      return {
        ...none,
        picture: 'KEEP',
        headline,
        road,
        lines,
        pills,
        label: `${headline.figure} ${headline.tail}. ${headline.caption}. ${keepShare(road)}.`
      };
    }
    const headline = roadHeadline(goal, road);
    const note = roadNote(road, goal.hero.weeklyRate.value);
    return {
      ...none,
      picture: 'ROAD',
      headline,
      note,
      road,
      lines,
      pills,
      label: `${headline.figure} ${headline.tail}. ${headline.caption}. ${formatNumber(Math.round(road.fractionWeight * 100))}% of the way.`
    };
  }
  if (lead.kind === 'HABIT' && habitCounts(lead.goal).logged === 0) {
    // Nothing logged yet: the goal is named, nothing is counted, and the picture says what fills it.
    const headline = habitEmptyHeadline(lead.goal);
    const empty = habitEmptyText(lead.goal);
    return { ...none, picture: 'NO_DATA', headline, habit: lead.goal, lines: [], pills, label: empty, empty };
  }
  if (lead.kind === 'HABIT') {
    const headline = habitHeadline(lead.goal);
    return {
      ...none,
      picture: 'HABIT',
      headline,
      habit: lead.goal,
      strip: habitItems(lead.goal),
      stripTarget: habitTarget(lead.goal),
      stripShare: habitShare(lead.goal),
      lines: lines.length ? lines : habitLines(lead.goal),
      pills,
      label: `${headline.figure} ${headline.tail}. ${headline.caption}.`
    };
  }
  return { ...none, picture: 'EMPTY', headline: EMPTY_HEADLINE, lines, pills, label: 'No goal yet. Set one in Me.' };
}
