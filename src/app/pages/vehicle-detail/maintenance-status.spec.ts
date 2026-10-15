import '../../i18n/i18n.config';
import { MaintenanceTaskResponse, MaintenanceTaskStatus } from '../../api-client';
import { computeTaskStatus } from './maintenance-status';

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

describe('computeTaskStatus', () => {
  it('formats overdue kilometres with the given locale', () => {
    const overdue = task({ status: MaintenanceTaskStatus.Overdue, kmRemaining: -1200, lastServiceMileage: 5000 });

    expect(computeTaskStatus(overdue, 'de-DE').label).toEqual({
      key: 'taskStatus.overdueKm',
      params: { value: '1.200' },
    });
    expect(computeTaskStatus(overdue, 'en-GB').label.params).toEqual({ value: '1,200' });
  });

  it('uses the singular key for exactly one day', () => {
    const dueSoon = task({ status: MaintenanceTaskStatus.DueSoon, daysRemaining: 1, lastServiceDate: '2026-01-01' });

    expect(computeTaskStatus(dueSoon, 'de-DE').label.key).toBe('taskStatus.dueSoonDay');
  });

  it('uses the plural key for several days', () => {
    const ok = task({ daysRemaining: 30, lastServiceDate: '2026-01-01' });

    expect(computeTaskStatus(ok, 'de-DE').label.key).toBe('taskStatus.okDays');
  });

  it('reports first-due wording for tasks that were never performed', () => {
    const firstDue = task({ kmRemaining: 500 });

    expect(computeTaskStatus(firstDue, 'de-DE').label.key).toBe('taskStatus.firstDueKm');
  });

  it('formats the completion date of done tasks with the given locale', () => {
    const done = task({ status: MaintenanceTaskStatus.Done, lastServiceDate: '2026-10-09', lastServiceMileage: 100 });

    expect(computeTaskStatus(done, 'de-DE').label).toEqual({
      key: 'taskStatus.doneOn',
      params: { date: '09.10.2026' },
    });
    expect(computeTaskStatus(done, 'en-GB').label.params).toEqual({ date: '9 Oct 2026' });
  });

  it('normalizes an exactly-due task to 0 instead of -0', () => {
    const exactlyDue = task({ status: MaintenanceTaskStatus.Overdue, kmRemaining: -0, lastServiceMileage: 1 });

    expect(computeTaskStatus(exactlyDue, 'de-DE').label.params).toEqual({ value: '0' });
  });
});
