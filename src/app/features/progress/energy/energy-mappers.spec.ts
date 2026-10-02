import { mapEnergyWeek } from './energy-mappers';
import { energyWire } from './energy-testing.spec';

describe('mapEnergyWeek', () => {
  it('maps a full week', () => {
    const week = mapEnergyWeek(energyWire());
    expect(week).toEqual(jasmine.objectContaining({ weekStart: '2026-09-28', status: 'OK', daysLogged: 5, bmrKcal: 1640, restingFactor: 1.2, weeklyKgEquivalent: -0.22 }));
    expect(week?.average).toEqual({ eaten: 2123, resting: 1968, workouts: 396, used: 2364, balance: -241 });
    expect(week?.mealSplit?.dinner).toBe(760);
    expect(week?.days.length).toBe(7);
    expect(week?.weeks.length).toBe(8);
  });

  it('keeps an unlogged day with no eaten figure and no balance', () => {
    const thursday = mapEnergyWeek(energyWire())?.days[3];
    expect(thursday).toEqual(jasmine.objectContaining({ logged: false, eaten: null, balance: null, runningTotal: null }));
  });

  it('reads a day as logged only when it has an eaten figure', () => {
    const week = mapEnergyWeek(energyWire({ days: [{ date: '2026-09-28', logged: true, eaten: null }] }));
    expect(week?.days[0].logged).toBeFalse();
  });

  it('marks estimated workout days and the estimated resting figure', () => {
    const week = mapEnergyWeek(energyWire({ bmrEstimated: true }));
    expect(week?.bmrEstimated).toBeTrue();
    expect(week?.days[4].workoutsEstimated).toBeTrue();
    expect(week?.days[0].workoutsEstimated).toBeFalse();
  });

  it('treats missing fields as null and not as zero', () => {
    const week = mapEnergyWeek({ weekStart: '2026-09-28', status: 'NO_PROFILE' });
    expect(week).toEqual(
      jasmine.objectContaining({ status: 'NO_PROFILE', bmrKcal: null, average: null, mealSplit: null, weeklyKgEquivalent: null, days: [], weeks: [], daysLogged: 0, weekEnd: '2026-09-28' })
    );
  });

  it('keeps a week without a weigh-in as a null scale figure', () => {
    expect(mapEnergyWeek(energyWire())?.weeks[1].actualKgChange).toBeNull();
  });

  it('reads the status the server gives, and works one out when it gives an unknown one', () => {
    expect(mapEnergyWeek(energyWire({ status: 'TOO_FEW_DAYS', daysLogged: 1 }))?.status).toBe('TOO_FEW_DAYS');
    expect(mapEnergyWeek(energyWire({ status: 'SOMETHING', bmrKcal: null }))?.status).toBe('NO_PROFILE');
    expect(mapEnergyWeek(energyWire({ status: 'SOMETHING', daysLogged: 2 }))?.status).toBe('TOO_FEW_DAYS');
    expect(mapEnergyWeek(energyWire({ status: undefined }))?.status).toBe('OK');
  });

  it('gives nothing for an answer with no week start', () => {
    expect(mapEnergyWeek({})).toBeNull();
  });

  it('drops days and weeks that cannot be placed', () => {
    const week = mapEnergyWeek(energyWire({ days: [{ eaten: 1 }, { date: '2026-09-28', logged: true, eaten: 1 }], weeks: [{}, { weekStart: '2026-09-28' }] }));
    expect(week?.days.length).toBe(1);
    expect(week?.weeks.length).toBe(1);
  });
});
