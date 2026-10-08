import { editPlanTarget, entryTarget } from './plan-entry';
import { widthBand } from './width-band';

describe('the ways into a plan', () => {
  it('sends Build my own to the flow with the default week', () => {
    expect(entryTarget('own')).toEqual({ commands: ['/workout/plans/new'] });
  });

  it('sends a template to the flow with its id', () => {
    expect(entryTarget('template', 'full-body-beginner')).toEqual({
      commands: ['/workout/plans/new'],
      queryParams: { template: 'full-body-beginner' }
    });
  });

  it('falls back to the default week for a template row without an id', () => {
    expect(entryTarget('template')).toEqual({ commands: ['/workout/plans/new'] });
  });

  it('sends the coach row to Plan Studio', () => {
    expect(entryTarget('coach')).toEqual({ commands: ['/coach/plan'], queryParams: { coach: 'open' } });
  });

  it('opens a saved plan at its edit address', () => {
    expect(editPlanTarget('plan-3')).toEqual({ commands: ['/workout/plans', 'plan-3', 'edit'] });
  });
});

describe('the width bands', () => {
  it('is wide from 900, medium from 600 and narrow below', () => {
    expect(widthBand(1120)).toBe('wide');
    expect(widthBand(900)).toBe('wide');
    expect(widthBand(899)).toBe('medium');
    expect(widthBand(600)).toBe('medium');
    expect(widthBand(599)).toBe('narrow');
    expect(widthBand(320)).toBe('narrow');
  });
});
