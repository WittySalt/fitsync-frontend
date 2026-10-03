import { daysBetween, formatNumber } from '../../../shared/progress/progress-format';
import { GoalProgress, GoalRoad, OtherGoal } from '../progress-api.models';
import {
  AlsoPill,
  FOUR_WEEKS,
  Span,
  CardHeadline,
  PictureNote,
  alsoPills,
  habitHeadline,
  habitItems,
  habitShare,
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

export type GoalPicture = 'ROAD' | 'KEEP' | 'HABIT' | 'EMPTY';

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
}

const EMPTY_HEADLINE: CardHeadline = { figure: 'No goal yet', tail: '', caption: 'Set one in Me' };

function weighIns(goal: GoalProgress, today: string, days: number): { logged: number; days: number } | null {
  const logged = goal.weight.daily.filter((day) => daysBetween(day.date, today) >= 0 && daysBetween(day.date, today) < days).length;
  return logged > 0 ? { logged, days } : null;
}

export function goalCardView(goal: GoalProgress, today: string, span: Span = FOUR_WEEKS): GoalView {
  const lead = leadOf(goal);
  const road = roadOf(goal, today);
  const lines = goalReadingLines(goal, road, span, weighIns(goal, today, span.days));
  const pills = alsoPills(goal, lead);
  const none = { habit: null, strip: [], stripTarget: '', stripShare: '', note: null, road: null };

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
    const note = roadNote(road);
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
      lines: lines.length ? lines : [{ figure: habitShare(lead.goal), text: 'of the logged days met the target', trend: '' }],
      pills,
      label: `${headline.figure} ${headline.tail}. ${headline.caption}.`
    };
  }
  return { ...none, picture: 'EMPTY', headline: EMPTY_HEADLINE, lines, pills, label: 'No goal yet. Set one in Me.' };
}
