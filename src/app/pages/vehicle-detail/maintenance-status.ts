import { MaintenanceTaskResponse, MaintenanceTaskStatus } from '../../api-client';

export type TaskStatusState = 'overdue' | 'due-soon' | 'ok' | 'done';

export interface TaskStatus {
  readonly state: TaskStatusState;
  readonly label: string;
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

/** Maps the backend-computed status fields on a task onto the German display labels used
 * throughout the UI. All due/overdue math lives in the backend; this is presentation only. */
export function computeTaskStatus(task: MaintenanceTaskResponse): TaskStatus {
  const state = STATE_BY_API_STATUS[task.status];
  const lastService =
    task.lastServiceMileage != null || task.lastServiceDate != null
      ? { mileage: task.lastServiceMileage ?? 0, date: task.lastServiceDate ?? '' }
      : null;

  return {
    state,
    label: buildLabel(task, state, lastService),
    lastService,
    progress: task.progress ?? null,
    remainingFraction: task.remainingFraction ?? null,
  };
}

function buildLabel(
  task: MaintenanceTaskResponse,
  state: TaskStatusState,
  lastService: TaskStatus['lastService'],
): string {
  if (state === 'done') {
    return lastService?.date ? `Erledigt am ${formatDate(lastService.date)}` : 'Erledigt';
  }

  const neverPerformed = lastService === null;

  if (task.kmRemaining != null) {
    return formatRemainingLabel(state, task.kmRemaining, 'km', neverPerformed);
  }
  if (task.daysRemaining != null) {
    return formatRemainingLabel(state, task.daysRemaining, 'Tagen', neverPerformed);
  }
  return neverPerformed ? 'Fällig (noch nie durchgeführt)' : 'OK';
}

function formatRemainingLabel(
  state: TaskStatusState,
  remaining: number,
  unit: 'km' | 'Tagen',
  neverPerformed: boolean,
): string {
  if (state === 'overdue') {
    return unit === 'km'
      ? `Überfällig um ${formatNumber(-remaining)} km`
      : `Überfällig seit ${formatNumber(-remaining)} Tagen`;
  }
  if (state === 'due-soon') {
    return `Fällig in ${formatNumber(remaining)} ${unit}`;
  }
  if (neverPerformed) {
    return `Erstfällig in ${formatNumber(remaining)} ${unit}`;
  }
  return `OK (${formatNumber(remaining)} ${unit === 'km' ? 'km' : 'Tage'} verbleibend)`;
}

function formatNumber(value: number): string {
  // `+ 0` normalizes -0 (e.g. an exactly-due task) to 0 before formatting.
  return (Math.round(value) + 0).toLocaleString('de-DE');
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('de-DE');
}
