import { MuscleGroupCode } from '../../../core/fitsync.models';
import { FOCUS_LINK, absentFocusGroups, expandFocusAreas, focusAreaGroups, focusLine } from './brief-focus';

const ALL: MuscleGroupCode[] = ['FULL_BODY', 'CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'CORE', 'GLUTES', 'LEGS', 'CARDIO'];
const without = (...codes: MuscleGroupCode[]): MuscleGroupCode[] => ALL.filter((code) => !codes.includes(code));

describe('focus areas as muscle groups', () => {
  it('expands each focus area that onboarding offers', () => {
    expect(focusAreaGroups('UPPER')).toEqual(['CHEST', 'BACK', 'SHOULDERS', 'ARMS']);
    expect(focusAreaGroups('LOWER')).toEqual(['LEGS', 'GLUTES']);
    expect(focusAreaGroups('CORE')).toEqual(['CORE']);
    expect(focusAreaGroups('CARDIO')).toEqual(['CARDIO']);
  });

  it('gives nothing for full body, mobility and an area it does not know', () => {
    expect(focusAreaGroups('FULL_BODY')).toEqual([]);
    expect(focusAreaGroups('MOBILITY')).toEqual([]);
    expect(focusAreaGroups('SOMETHING_NEW')).toEqual([]);
  });

  it('lists each group once, in wheel order, with the area that asked for it', () => {
    const groups = expandFocusAreas(['LOWER', 'UPPER', 'UPPER', 'CORE']);
    expect(groups.map((group) => group.code)).toEqual(['LEGS', 'GLUTES', 'CHEST', 'BACK', 'SHOULDERS', 'ARMS', 'CORE']);
    expect(groups.find((group) => group.code === 'GLUTES')?.area).toBe('LOWER');
  });

  it('keeps only the groups that have no sector', () => {
    expect(absentFocusGroups(['UPPER'], without('SHOULDERS', 'ARMS')).map((group) => group.code)).toEqual(['SHOULDERS', 'ARMS']);
  });
});

describe('focusLine', () => {
  it('names one group and offers to add it', () => {
    expect(focusLine(['CORE'], without('CORE'))).toEqual({
      sentence: 'Core belongs to your core focus and is not in your plan.',
      linkText: 'Add it',
      groups: ['CORE']
    });
  });

  it('names two groups from one area, as the board does', () => {
    expect(focusLine(['UPPER'], without('SHOULDERS', 'ARMS'))).toEqual({
      sentence: 'Shoulders and arms belong to your upper-body focus and are not in your plan.',
      linkText: 'Add them',
      groups: ['SHOULDERS', 'ARMS']
    });
  });

  it('names three groups from one area', () => {
    expect(focusLine(['UPPER'], without('BACK', 'SHOULDERS', 'ARMS'))?.sentence).toBe(
      'Back, shoulders and arms belong to your upper-body focus and are not in your plan.'
    );
  });

  it('counts the groups once there are more than three', () => {
    const line = focusLine(['UPPER'], without('CHEST', 'BACK', 'SHOULDERS', 'ARMS'));
    expect(line?.sentence).toBe('Four of your focus areas are not in your plan.');
    expect(line?.linkText).toBe('Add them');
  });

  it('names the area for the lower body', () => {
    expect(focusLine(['LOWER'], without('LEGS', 'GLUTES'))?.sentence).toBe(
      'Legs and glutes belong to your lower-body focus and are not in your plan.'
    );
  });

  it('does not name an area when the groups come from more than one', () => {
    expect(focusLine(['UPPER', 'LOWER'], without('SHOULDERS', 'GLUTES'))?.sentence).toBe(
      'Shoulders and glutes are among your focus areas and are not in your plan.'
    );
  });

  it('lists three groups from mixed areas', () => {
    expect(focusLine(['UPPER', 'LOWER'], without('SHOULDERS', 'ARMS', 'GLUTES'))?.sentence).toBe(
      'Shoulders, arms and glutes are among your focus areas and are not in your plan.'
    );
  });

  it('says nothing when every group of the focus is on the wheel', () => {
    expect(focusLine(['UPPER', 'LOWER', 'CORE'], ALL)).toBeNull();
  });

  it('says nothing for focus areas that expand to no group, or for no focus at all', () => {
    expect(focusLine(['FULL_BODY', 'MOBILITY'], [])).toBeNull();
    expect(focusLine([], [])).toBeNull();
  });

  it('ignores an area it cannot map and still reports the rest', () => {
    expect(focusLine(['SOMETHING_NEW', 'CORE'], [])?.groups).toEqual(['CORE']);
  });

  it('uses no word that presses or warns', () => {
    const line = focusLine(['UPPER'], [])!;
    expect(line.sentence).not.toMatch(/should|missing|forgot|warning/i);
  });
});

describe('the link of the focus line', () => {
  it('opens the plans tab of the Workout page', () => {
    expect(FOCUS_LINK.path).toEqual(['/workout']);
    expect(FOCUS_LINK.queryParams).toEqual({ tab: 'plans' });
  });
});
