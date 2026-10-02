import { MaintenanceLogResponse, MaintenanceTaskResponse } from '../../api-client';

export type TaskStatusState = 'overdue' | 'due-soon' | 'ok' | 'done';

export interface TaskStatus {
  readonly state: TaskStatusState;
  readonly label: string;
  readonly lastService: { readonly mileage: number; readonly date: string } | null;
  readonly progress: number | null;
  /** Signed remaining fraction of whichever interval (km or time) is currently more
   * urgent — negative once overdue (e.g. -0.1 means 10% past due). Unitless, so it's
   * comparable across tasks and across km/time axes for sorting by urgency. Null when
   * the task has no interval to track. */
  readonly remainingFraction: number | null;
}

/** Below this many remaining km, a task counts as "due soon" rather than "ok" — a fixed
 * distance reads more usefully than a fraction of the interval (1000 km left is worth
 * flagging whether the interval is 3000 km or 30000 km). */
const DUE_SOON_THRESHOLD_KM = 1000;

/** Time equivalent of DUE_SOON_THRESHOLD_KM — a fixed number of days reads more usefully
 * than a fraction of the interval, same reasoning as the km threshold. */
const DUE_SOON_THRESHOLD_DAYS = 30;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Average month length — good enough for estimating a due date, not calendar-exact. */
const DAYS_PER_MONTH = 30.44;

interface AxisStatus {
  readonly state: 'overdue' | 'due-soon' | 'ok';
  readonly label: string;
  readonly progress: number;
  readonly fraction: number;
}

const AXIS_SEVERITY: Record<AxisStatus['state'], number> = { ok: 0, 'due-soon': 1, overdue: 2 };

export function computeTaskStatus(
  task: MaintenanceTaskResponse,
  currentMileage: number,
  logs: readonly MaintenanceLogResponse[],
): TaskStatus {
  const lastLog = findLastLog(task.id, logs);

  if (!lastLog) {
    // Never performed — treat it as due from km/time zero so it doesn't go unnoticed
    // just because it's never been logged.
    const firstDueKm =
      (task.firstDueKm && task.firstDueKm > 0 ? task.firstDueKm : null) ??
      (task.intervalKm && task.intervalKm > 0 ? task.intervalKm : null);

    if (firstDueKm !== null) {
      const remaining = firstDueKm - currentMileage;
      const axis = evaluateKmAxis(firstDueKm, 0, currentMileage);
      const label = axis.state === 'ok' ? `Erstfällig in ${formatNumber(remaining)} km` : axis.label;
      return { state: axis.state, label, lastService: null, progress: axis.progress, remainingFraction: axis.fraction };
    }

    // No km anchor at all (a purely time-based interval) — there's no first-use date to
    // measure from (tasks/vehicles don't expose one), so flag it rather than hide it.
    return {
      state: 'due-soon',
      label: 'Fällig (noch nie durchgeführt)',
      lastService: null,
      progress: null,
      remainingFraction: 0,
    };
  }

  const lastService = {
    mileage: lastLog.mileageAtPerformed ?? 0,
    date: lastLog.performedAt ?? '',
  };

  if (task.oneTime) {
    const suffix = lastService.date ? ` am ${formatDate(lastService.date)}` : '';
    return { state: 'done', label: `Erledigt${suffix}`, lastService, progress: null, remainingFraction: null };
  }

  const kmAxis =
    task.intervalKm && task.intervalKm > 0
      ? evaluateKmAxis(task.intervalKm, lastService.mileage, currentMileage)
      : null;

  const lastServiceDate = lastService.date ? new Date(lastService.date) : null;
  const timeAxis =
    task.intervalMonths && task.intervalMonths > 0 && lastServiceDate && !Number.isNaN(lastServiceDate.getTime())
      ? evaluateTimeAxis(task.intervalMonths, lastServiceDate)
      : null;

  const axes = [kmAxis, timeAxis].filter((axis): axis is AxisStatus => axis !== null);
  if (!axes.length) {
    return { state: 'ok', label: 'OK', lastService, progress: null, remainingFraction: null };
  }

  const worst = axes.reduce((a, b) => (AXIS_SEVERITY[b.state] > AXIS_SEVERITY[a.state] ? b : a));
  const progress = Math.max(...axes.map((axis) => axis.progress));

  return {
    state: worst.state,
    label: worst.label,
    lastService,
    progress,
    remainingFraction: worst.fraction,
  };
}

function evaluateKmAxis(intervalKm: number, lastMileage: number, currentMileage: number): AxisStatus {
  const remaining = lastMileage + intervalKm - currentMileage;
  const progress = clamp((currentMileage - lastMileage) / intervalKm);
  const fraction = remaining / intervalKm;

  if (remaining <= 0) {
    return { state: 'overdue', label: `Überfällig um ${formatNumber(-remaining)} km`, progress, fraction };
  }
  if (remaining <= DUE_SOON_THRESHOLD_KM) {
    return { state: 'due-soon', label: `Fällig in ${formatNumber(remaining)} km`, progress, fraction };
  }
  return { state: 'ok', label: `OK (${formatNumber(remaining)} km verbleibend)`, progress, fraction };
}

function evaluateTimeAxis(intervalMonths: number, lastServiceDate: Date): AxisStatus {
  const intervalDays = intervalMonths * DAYS_PER_MONTH;
  const elapsedDays = (Date.now() - lastServiceDate.getTime()) / MS_PER_DAY;
  const remaining = intervalDays - elapsedDays;
  const progress = clamp(elapsedDays / intervalDays);
  const fraction = remaining / intervalDays;

  if (remaining <= 0) {
    return { state: 'overdue', label: `Überfällig seit ${formatNumber(-remaining)} Tagen`, progress, fraction };
  }
  if (remaining <= DUE_SOON_THRESHOLD_DAYS) {
    return { state: 'due-soon', label: `Fällig in ${formatNumber(remaining)} Tagen`, progress, fraction };
  }
  return { state: 'ok', label: `OK (${formatNumber(remaining)} Tage verbleibend)`, progress, fraction };
}

function findLastLog(
  taskId: number | undefined,
  logs: readonly MaintenanceLogResponse[],
): MaintenanceLogResponse | null {
  if (taskId === undefined) {
    return null;
  }
  const matching = logs.filter((log) => log.performedTaskIds?.includes(taskId));
  if (!matching.length) {
    return null;
  }
  return matching.reduce((latest, log) =>
    (log.performedAt ?? '') > (latest.performedAt ?? '') ? log : latest,
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function formatNumber(value: number): string {
  // `+ 0` normalizes -0 (e.g. an exactly-due task) to 0 before formatting.
  return (Math.round(value) + 0).toLocaleString('de-DE');
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('de-DE');
}
