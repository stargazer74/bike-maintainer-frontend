import { formatNumber } from '@angular/common';
import { MaintenanceTaskResponse } from '../../api-client';
import { TranslatableText } from '../../i18n/translatable-text';

/** Human-readable summary of a task's due interval for the management list. */
export function describeTaskInterval(
  task: MaintenanceTaskResponse,
  locale: string,
): TranslatableText {
  if (task.oneTime) {
    return { key: 'taskInterval.oneTime' };
  }
  const km = task.intervalKm ? formatNumber(task.intervalKm, locale) : null;
  const months = task.intervalMonths || null;
  if (km && months) {
    return { key: 'taskInterval.everyKmOrMonths', params: { km, months } };
  }
  if (km) {
    return { key: 'taskInterval.everyKm', params: { km } };
  }
  if (months) {
    return {
      key: months === 1 ? 'taskInterval.everyMonth' : 'taskInterval.everyMonths',
      params: { months },
    };
  }
  return { key: 'taskInterval.none' };
}
