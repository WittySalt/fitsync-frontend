import { FirstSessionAnswers, answersFromSeed, difficultyLabel, movesLabel, pickFirstSessions, templateKind } from './first-sessions';

interface Fixture {
  id: string;
  goalFocus: string;
  workoutType: string;
  difficulty: string;
  estimatedDurationMinutes: number;
  exercises: unknown[];
}

function template(id: string, workoutType: string, goalFocus: string, difficulty: string, minutes: number): Fixture {
  return { id, workoutType, goalFocus, difficulty, estimatedDurationMinutes: minutes, exercises: [{}, {}, {}] };
}

const FULL_BODY = template('full-body', 'STRENGTH', 'GENERAL_FITNESS', 'BEGINNER', 35);
const SPLIT = template('split', 'STRENGTH', 'STRENGTH', 'INTERMEDIATE', 50);
const HIIT = template('hiit', 'HIIT', 'ENDURANCE', 'BEGINNER', 25);
const MOBILITY = template('mobility', 'MOBILITY', 'MOBILITY', 'BEGINNER', 20);
const ALL = [FULL_BODY, SPLIT, HIIT, MOBILITY];

function answers(overrides: Partial<FirstSessionAnswers>): FirstSessionAnswers {
  return { primaryGoal: null, experienceLevel: null, preferredMinutes: null, ...overrides };
}

function ids(list: Fixture[]): string[] {
  return list.map((entry) => entry.id);
}

describe('pickFirstSessions', () => {
  it('offers the first three in their own order when there are no answers', () => {
    expect(ids(pickFirstSessions(ALL, null))).toEqual(['full-body', 'split', 'hiit']);
    expect(ids(pickFirstSessions(ALL, answers({})))).toEqual(['full-body', 'split', 'hiit']);
  });

  it('ranks a template whose difficulty matches the experience level before one that does not', () => {
    expect(ids(pickFirstSessions(ALL, answers({ experienceLevel: 'INTERMEDIATE' })))).toEqual(['split', 'full-body', 'hiit']);
  });

  it('keeps the templates own order among those that match the level', () => {
    expect(ids(pickFirstSessions(ALL, answers({ experienceLevel: 'BEGINNER' })))).toEqual(['full-body', 'hiit', 'mobility']);
  });

  it('leaves the level rule out when nothing matches it', () => {
    expect(ids(pickFirstSessions(ALL, answers({ experienceLevel: 'ADVANCED' })))).toEqual(['full-body', 'split', 'hiit']);
  });

  it('ranks the goal fit among the templates of the same level', () => {
    const level = { experienceLevel: 'BEGINNER' };
    expect(ids(pickFirstSessions(ALL, answers({ ...level, primaryGoal: 'LOSE_FAT' })))[0]).toBe('hiit');
    expect(ids(pickFirstSessions(ALL, answers({ ...level, primaryGoal: 'LOSE_FAT' })))[1]).toBe('full-body');
    expect(ids(pickFirstSessions(ALL, answers({ ...level, primaryGoal: 'MOBILITY' })))[0]).toBe('mobility');
    expect(ids(pickFirstSessions(ALL, answers({ ...level, primaryGoal: 'IMPROVE_FITNESS' })))[0]).toBe('full-body');
  });

  it('favours the strength plans for building muscle', () => {
    expect(ids(pickFirstSessions(ALL, answers({ primaryGoal: 'BUILD_MUSCLE' }))).slice(0, 2)).toEqual(['full-body', 'split']);
    expect(ids(pickFirstSessions([HIIT, MOBILITY, SPLIT, FULL_BODY], answers({ primaryGoal: 'BUILD_MUSCLE' })))).toEqual(['split', 'full-body', 'hiit']);
  });

  it('puts the level before the goal', () => {
    expect(ids(pickFirstSessions(ALL, answers({ experienceLevel: 'INTERMEDIATE', primaryGoal: 'LOSE_FAT' })))[0]).toBe('split');
  });

  it('breaks a tie on the goal by the length closest to the preferred minutes', () => {
    const picked = pickFirstSessions(ALL, answers({ experienceLevel: 'BEGINNER', preferredMinutes: 22 }));
    expect(ids(picked)).toEqual(['mobility', 'hiit', 'full-body']);
  });

  it('keeps the templates own order when everything ties', () => {
    const twins = [template('a', 'STRENGTH', 'GENERAL_FITNESS', 'BEGINNER', 30), template('b', 'STRENGTH', 'GENERAL_FITNESS', 'BEGINNER', 30), template('c', 'STRENGTH', 'GENERAL_FITNESS', 'BEGINNER', 30)];
    expect(ids(pickFirstSessions(twins, answers({ experienceLevel: 'BEGINNER', primaryGoal: 'MAINTAIN', preferredMinutes: 30 })))).toEqual(['a', 'b', 'c']);
  });

  it('does not change the list it was given', () => {
    const copy = [...ALL];
    pickFirstSessions(ALL, answers({ experienceLevel: 'INTERMEDIATE' }));
    expect(ALL).toEqual(copy);
  });

  it('returns three when at least three exist and all of them when fewer do', () => {
    expect(pickFirstSessions(ALL, answers({ primaryGoal: 'MOBILITY' })).length).toBe(3);
    expect(pickFirstSessions([FULL_BODY, SPLIT, HIIT], null).length).toBe(3);
    expect(pickFirstSessions([FULL_BODY, SPLIT], null).length).toBe(2);
    expect(pickFirstSessions([] as Fixture[], null)).toEqual([]);
  });
});

describe('answersFromSeed', () => {
  it('reads the level and the minutes and infers losing fat from a lower target weight', () => {
    expect(answersFromSeed({ fitnessLevel: 'BEGINNER', preferredDurationMinutes: 40, currentWeightKg: 80, targetWeightKg: 74 })).toEqual({
      primaryGoal: 'LOSE_FAT',
      experienceLevel: 'BEGINNER',
      preferredMinutes: 40
    });
  });

  it('infers building muscle from a higher target and leaves the goal open when the weight is unchanged', () => {
    expect(answersFromSeed({ currentWeightKg: 70, targetWeightKg: 74 }).primaryGoal).toBe('BUILD_MUSCLE');
    expect(answersFromSeed({ currentWeightKg: 70, targetWeightKg: 70 }).primaryGoal).toBeNull();
  });

  it('takes the primary goal the profile keeps before any inference', () => {
    expect(answersFromSeed({ primaryGoal: 'IMPROVE_FITNESS', currentWeightKg: 80, targetWeightKg: 74 }).primaryGoal).toBe('IMPROVE_FITNESS');
  });

  it('leaves everything open for an empty seed', () => {
    expect(answersFromSeed({})).toEqual({ primaryGoal: null, experienceLevel: null, preferredMinutes: null });
  });
});

describe('card labels', () => {
  it('writes the moves and minutes line', () => {
    expect(movesLabel(FULL_BODY as never)).toBe('3 moves · 35 min');
    expect(movesLabel({ exercises: [{}], estimatedDurationMinutes: 20 } as never)).toBe('1 move · 20 min');
  });

  it('writes the difficulty in sentence case', () => {
    expect(difficultyLabel('INTERMEDIATE')).toBe('Intermediate');
  });

  it('draws HIIT as cardio, mobility as mobility and the rest as strength', () => {
    expect(templateKind({ workoutType: 'HIIT' })).toBe('CARDIO');
    expect(templateKind({ workoutType: 'MOBILITY' })).toBe('MOBILITY');
    expect(templateKind({ workoutType: 'STRENGTH' })).toBe('STRENGTH');
  });
});
