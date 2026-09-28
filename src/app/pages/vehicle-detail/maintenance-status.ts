import { MaintenanceLogResponse, MaintenanceTaskResponse } from '../../api-client';

export type TaskStatusState = 'overdue' | 'due-soon' | 'ok' | 'done' | 'none';

export interface TaskStatus {
  readonly state: TaskStatusState;
  readonly label: string;
  readonly lastService: { readonly mileage: number; readonly date: string } | null;
  readonly progress: number | null;
}

/** Below this many remaining km, a task counts as "due soon" rather than "ok" — a fixed
 * distance reads more usefully than a fraction of the interval (1000 km left is worth
 * flagging whether the interval is 3000 km or 30000 km). */
const DUE_SOON_THRESHOLD_KM = 1000;

export function computeTaskStatus(
  task: MaintenanceTaskResponse,
  currentMileage: number,
  logs: readonly MaintenanceLogResponse[],
): TaskStatus {
  const lastLog = findLastLog(task.id, logs);

  if (!lastLog) {
    const progress =
      task.firstDueKm && task.firstDueKm > 0 ? clamp(currentMileage / task.firstDueKm) : null;
    return { state: 'none', label: 'Kein Eintrag', lastService: null, progress };
  }

  const lastService = {
    mileage: lastLog.mileageAtPerformed ?? 0,
    date: lastLog.performedAt ?? '',
  };

  if (task.oneTime) {
    const suffix = lastService.date ? ` am ${formatDate(lastService.date)}` : '';
    return { state: 'done', label: `Erledigt${suffix}`, lastService, progress: null };
  }

  if (!task.intervalKm) {
    return { state: 'ok', label: 'OK', lastService, progress: null };
  }

  const nextDueKm = lastService.mileage + task.intervalKm;
  const remaining = nextDueKm - currentMileage;
  const progress = clamp((currentMileage - lastService.mileage) / task.intervalKm);

  if (remaining <= 0) {
    return {
      state: 'overdue',
      label: `Überfällig um ${formatKm(-remaining)} km`,
      lastService,
      progress,
    };
  }
  if (remaining <= DUE_SOON_THRESHOLD_KM) {
    return { state: 'due-soon', label: `Fällig in ${formatKm(remaining)} km`, lastService, progress };
  }
  return { state: 'ok', label: `OK (${formatKm(remaining)} km verbleibend)`, lastService, progress };
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

function formatKm(value: number): string {
  // `+ 0` normalizes -0 (e.g. an exactly-due task) to 0 before formatting.
  return (Math.round(value) + 0).toLocaleString('de-DE');
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('de-DE');
}
