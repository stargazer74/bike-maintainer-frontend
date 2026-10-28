import '../../i18n/i18n.config';
import { MaintenanceTaskResponse, MaintenanceTaskStatus } from '../../api-client';
import { describeTaskInterval } from './task-interval';

function task(overrides: Partial<MaintenanceTaskResponse>): MaintenanceTaskResponse {
  return {
    id: 1,
    vehicleId: 1,
    name: 'Ölwechsel',
    oneTime: false,
    active: true,
    status: MaintenanceTaskStatus.Ok,
    ...overrides,
  };
}

describe('describeTaskInterval', () => {
  it('describes one-time tasks', () => {
    expect(describeTaskInterval(task({ oneTime: true, intervalKm: 1000 }), 'de-DE')).toEqual({
      key: 'taskInterval.oneTime',
    });
  });

  it('combines km and months, formatting km with the locale', () => {
    expect(describeTaskInterval(task({ intervalKm: 10000, intervalMonths: 12 }), 'de-DE')).toEqual({
      key: 'taskInterval.everyKmOrMonths',
      params: { km: '10.000', months: 12 },
    });
    expect(describeTaskInterval(task({ intervalKm: 10000 }), 'en-GB')).toEqual({
      key: 'taskInterval.everyKm',
      params: { km: '10,000' },
    });
  });

  it('uses the singular wording for a one-month interval', () => {
    expect(describeTaskInterval(task({ intervalMonths: 1 }), 'de-DE').key).toBe(
      'taskInterval.everyMonth',
    );
  });

  it('reports a missing interval', () => {
    expect(describeTaskInterval(task({}), 'de-DE')).toEqual({ key: 'taskInterval.none' });
  });
});
