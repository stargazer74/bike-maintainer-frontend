import { formatDate, formatNumber } from '@angular/common';
import { MaintenanceTaskResponse, MaintenanceTaskStatus } from '../../api-client';
import { TranslatableText } from '../../i18n/translatable-text';

export type TaskStatusState = 'overdue' | 'due-soon' | 'ok' | 'done';

export interface TaskStatus {
  readonly state: TaskStatusState;
  readonly label: TranslatableText;
  readonly lastService: { readonly mileage: number; readonly date: string } | null;
  readonly progress: number | null;
  /** Signed remaining fraction of whichever interval (km or time) is currently more
   * urgent — negative once overdue (e.g. -0.1 means 10% past due). Unitless, so it's
   * comparable across tasks and across km/time axes for sorting by urgency. Null when
   * the task has no interval to track. Computed by the backend. */
  readonly remainingFraction: number | null;
}

const STATE_BY_API_STATUS: Record<MaintenanceTaskStatus, TaskStatusState> = {
  [MaintenanceTaskStatus.Overdue]: 'overdue',
  [MaintenanceTaskStatus.DueSoon]: 'due-soon',
  [MaintenanceTaskStatus.Ok]: 'ok',
  [MaintenanceTaskStatus.Done]: 'done',
};

/** Maps the backend-computed status fields on a task onto display labels (translation keys whose
 * numbers/dates are pre-formatted with `locale`). All due/overdue math lives in the backend; this is
 * presentation only. */
export function computeTaskStatus(task: MaintenanceTaskResponse, locale: string): TaskStatus {
  const state = STATE_BY_API_STATUS[task.status];
  const lastService =
    task.lastServiceMileage != null || task.lastServiceDate != null
      ? { mileage: task.lastServiceMileage ?? 0, date: task.lastServiceDate ?? '' }
      : null;

  return {
    state,
    label: buildLabel(task, state, lastService, locale),
    lastService,
    progress: task.progress ?? null,
    remainingFraction: task.remainingFraction ?? null,
  };
}

function buildLabel(
  task: MaintenanceTaskResponse,
  state: TaskStatusState,
  lastService: TaskStatus['lastService'],
  locale: string,
): TranslatableText {
  if (state === 'done') {
    return lastService?.date
      ? { key: 'taskStatus.doneOn', params: { date: formatIsoDate(lastService.date, locale) } }
      : { key: 'taskStatus.done' };
  }

  const neverPerformed = lastService === null;

  if (task.kmRemaining != null) {
    return remainingLabel(state, task.kmRemaining, 'Km', neverPerformed, locale);
  }
  if (task.daysRemaining != null) {
    return remainingLabel(state, task.daysRemaining, 'Days', neverPerformed, locale);
  }
  return { key: neverPerformed ? 'taskStatus.neverPerformed' : 'taskStatus.ok' };
}

/** Keys come in a Km and a Days variant; days additionally have a singular variant ("1 Tag"). */
function remainingLabel(
  state: TaskStatusState,
  remaining: number,
  unit: 'Km' | 'Days',
  neverPerformed: boolean,
  locale: string,
): TranslatableText {
  const shown = state === 'overdue' ? -remaining : remaining;
  // `+ 0` normalizes -0 (e.g. an exactly-due task) to 0 before formatting.
  const rounded = Math.round(shown) + 0;
  const prefix =
    state === 'overdue'
      ? 'overdue'
      : state === 'due-soon'
        ? 'dueSoon'
        : neverPerformed
          ? 'firstDue'
          : 'ok';
  const suffix = unit === 'Days' && Math.abs(rounded) === 1 ? 'Day' : unit;
  return { key: `taskStatus.${prefix}${suffix}`, params: { value: formatNumber(rounded, locale) } };
}

function formatIsoDate(iso: string, locale: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatDate(date, 'mediumDate', locale);
}
