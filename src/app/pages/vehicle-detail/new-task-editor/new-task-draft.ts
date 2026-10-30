import { NewMaintenanceTaskRequest } from '../../../api-client';

/** Work entered while recording maintenance that is no task yet (e.g. a repair). */
export interface NewTaskDraft {
  /** Local identity for the list; not sent. */
  readonly key: number;
  readonly name: string;
  readonly description: string;
  /** Recurring tasks need an interval; otherwise the work is a one-time task. */
  readonly recurring: boolean;
  readonly intervalKm: number | null;
  readonly intervalMonths: number | null;
}

let nextKey = 1;

export function emptyDraft(): NewTaskDraft {
  return {
    key: nextKey++,
    name: '',
    description: '',
    recurring: false,
    intervalKm: null,
    intervalMonths: null,
  };
}

function positive(value: number | null): number | undefined {
  return value !== null && value > 0 ? value : undefined;
}

/** Translation key of the problem with a draft, or `null` if it can be saved. */
export function draftError(draft: NewTaskDraft): string | null {
  if (!draft.name.trim()) {
    return 'newTask.errors.nameRequired';
  }
  if (
    draft.recurring &&
    positive(draft.intervalKm) === undefined &&
    positive(draft.intervalMonths) === undefined
  ) {
    return 'newTask.errors.intervalRequired';
  }
  return null;
}

/** Request entries for the backend; an interval is only sent for recurring work. */
export function toNewTaskRequests(drafts: readonly NewTaskDraft[]): NewMaintenanceTaskRequest[] {
  return drafts.map((draft) => ({
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    intervalKm: draft.recurring ? positive(draft.intervalKm) : undefined,
    intervalMonths: draft.recurring ? positive(draft.intervalMonths) : undefined,
  }));
}
