import { BadgeEvidence, BadgeNode, BadgePath, BadgeThemeGroup, BadgesModel, Footprint, FootprintDay } from './me.models';

type Loose = Record<string, unknown> | null | undefined;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function asRecord(value: unknown): Loose {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function day(value: unknown): string {
  const raw = text(value).slice(0, 10);
  return DAY.test(raw) ? raw : '';
}

function count(value: unknown): number {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function mapFootprint(response: unknown): Footprint {
  const body = asRecord(response) ?? {};
  const days: FootprintDay[] = (Array.isArray(body['days']) ? (body['days'] as unknown[]) : [])
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => !!entry && day(entry['date']) !== '')
    .map((entry) => ({ date: day(entry['date']), trained: entry['trained'] === true, logged: entry['logged'] === true }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const totals = asRecord(body['totals']) ?? {};
  return {
    memberSince: day(body['memberSince']),
    from: day(body['from']) || days[0]?.date || '',
    to: day(body['to']) || days[days.length - 1]?.date || '',
    days,
    totals: { workouts: count(totals?.['workouts']), daysLogged: count(totals?.['daysLogged']), badges: count(totals?.['badges']) }
  };
}

function mapEvidence(value: unknown): BadgeEvidence | null {
  const evidence = asRecord(value);
  if (!evidence) {
    return null;
  }
  return {
    weekStart: day(evidence['weekStart']) || null,
    sessionId: text(evidence['sessionId']) || null,
    recordId: text(evidence['recordId']) || null,
    line: text(evidence['line']).trim() || null
  };
}

export function mapBadge(value: unknown): BadgeNode | null {
  const badge = asRecord(value);
  const code = text(badge?.['code']);
  if (!badge || !code) {
    return null;
  }
  const progress = asRecord(badge['progress']) ?? {};
  const pace = typeof badge['pace'] === 'number' && Number.isFinite(badge['pace']) && badge['pace'] > 0 ? badge['pace'] : null;
  return {
    code,
    theme: text(badge['theme']),
    name: text(badge['name']).trim() || code,
    how: text(badge['how']).trim(),
    earnedOn: day(badge['earnedOn']) || null,
    progress: { current: count(progress['current']), target: count(progress['target']), unit: text(progress['unit']) },
    evidence: mapEvidence(badge['evidence']),
    pace
  };
}

function mapThemes(value: unknown): BadgeThemeGroup[] {
  return (Array.isArray(value) ? (value as unknown[]) : [])
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => !!entry)
    .map((theme) => {
      const paths: BadgePath[] = (Array.isArray(theme['paths']) ? (theme['paths'] as unknown[]) : [])
        .map((path) => asRecord(path))
        .filter((path): path is Record<string, unknown> => !!path)
        .map((path) => ({
          nodes: (Array.isArray(path['nodes']) ? (path['nodes'] as unknown[]) : [])
            .map(mapBadge)
            .filter((node): node is BadgeNode => node !== null)
        }))
        .filter((path) => path.nodes.length > 0);
      return { code: text(theme['code']), name: text(theme['name']).trim() || text(theme['code']), paths };
    })
    .filter((theme) => theme.paths.length > 0);
}

export function mapBadges(response: unknown): BadgesModel {
  const body = asRecord(response) ?? {};
  const themes = mapThemes(body['themes']);
  const nodes = themes.flatMap((theme) => theme.paths.flatMap((path) => path.nodes));
  const earnedNodes = nodes.filter((node) => node.earnedOn !== null);
  const total = count(body['total']) || nodes.length;
  return {
    themes,
    earned: body['earned'] === undefined ? earnedNodes.length : count(body['earned']),
    total,
    latest: mapBadge(body['latest']),
    nextUp: (Array.isArray(body['nextUp']) ? (body['nextUp'] as unknown[]) : [])
      .map(mapBadge)
      .filter((node): node is BadgeNode => node !== null)
      .slice(0, 2),
    earlier: (Array.isArray(body['earlier']) ? (body['earlier'] as unknown[]) : [])
      .map(mapBadge)
      .filter((node): node is BadgeNode => node !== null),
    since: day(body['since'])
  };
}
