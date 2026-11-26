import {
  ApplyTemplateRequest,
  VehicleResponse,
  VehicleTemplateResponse,
  VehicleTemplateTaskResponse,
} from '../../../api-client';

export interface TemplateTaskRow {
  task: VehicleTemplateTaskResponse;
  selected: boolean;
  existing: boolean;
  lastDoneKm: number | null;
  lastDoneDate: string | null;
}

const REPORT_BASE =
  'https://github.com/stargazer74/bike-maintainer-templates/issues/new?template=fehler-in-vorlage.yml';

/** Adds whole months to an ISO date (YYYY-MM-DD), clamping the day to the target month's length. */
function addMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(targetYear, 4)}-${pad(targetMonth + 1, 2)}-${pad(Math.min(day, lastDay), 2)}`;
}

function firstDueAlreadyPassed(
  task: VehicleTemplateTaskResponse,
  vehicle: VehicleResponse,
  today: string,
): boolean {
  if (task.firstDueKm != null && task.firstDueKm <= vehicle.currentMileage) {
    return true;
  }
  return (
    task.firstDueMonths != null &&
    addMonths(vehicle.firstRegistrationDate, task.firstDueMonths) <= today
  );
}

export function initialRows(
  template: VehicleTemplateResponse,
  existingKeys: ReadonlySet<string>,
  vehicle: VehicleResponse,
  today: string,
): TemplateTaskRow[] {
  return template.tasks.map((task) => {
    const existing = existingKeys.has(task.key);
    const selected = !existing && !(task.oneTime && firstDueAlreadyPassed(task, vehicle, today));
    return { task, selected, existing, lastDoneKm: null, lastDoneDate: null };
  });
}

export function fillEmpty(
  rows: TemplateTaskRow[],
  currentMileage: number,
  today: string,
): TemplateTaskRow[] {
  return rows.map((row) =>
    row.existing
      ? { ...row }
      : {
          ...row,
          lastDoneKm: row.lastDoneKm ?? currentMileage,
          lastDoneDate: row.lastDoneDate ?? today,
        },
  );
}

export function toApplyRequest(templateId: string, rows: TemplateTaskRow[]): ApplyTemplateRequest {
  return {
    templateId,
    tasks: rows
      .filter((row) => row.selected && !row.existing)
      .map((row) => ({
        key: row.task.key,
        ...(row.lastDoneKm != null ? { lastDoneKm: row.lastDoneKm } : {}),
        ...(row.lastDoneDate != null ? { lastDoneDate: row.lastDoneDate } : {}),
      })),
  };
}

export function reportUrl(templateId: string, taskKey?: string): string {
  const task = taskKey ? `&aufgabe=${encodeURIComponent(taskKey)}` : '';
  return `${REPORT_BASE}&vorlage=${encodeURIComponent(templateId)}${task}`;
}
