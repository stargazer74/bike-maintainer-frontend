import { MaintenanceTaskResponse } from '../../api-client';

/** Human-readable summary of a task's due interval for the management list. */
export function describeTaskInterval(task: MaintenanceTaskResponse): string {
  if (task.oneTime) {
    return 'Einmalige Aufgabe';
  }
  const parts: string[] = [];
  if (task.intervalKm) {
    parts.push(`${task.intervalKm.toLocaleString('de-DE')} km`);
  }
  if (task.intervalMonths) {
    parts.push(`${task.intervalMonths} Monate`);
  }
  if (!parts.length) {
    return 'Kein Intervall hinterlegt';
  }
  return `Alle ${parts.join(' oder ')}`;
}
