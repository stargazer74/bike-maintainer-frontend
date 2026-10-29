import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  MaintenanceTasksService,
  MaintenanceTaskResponse,
  MaintenanceTaskStatus,
} from '../../../api-client';
import { LanguageService } from '../../../i18n/language';
import { saveFile } from '../../../shared/download';
import { computeTaskStatus } from '../maintenance-status';

export interface ChecklistDialogData {
  readonly vehicleId: number;
  readonly tasks: readonly MaintenanceTaskResponse[];
}

/** Same order as the backend prints them: overdue, due soon, the rest; then by remaining fraction and name. */
const URGENCY: Record<MaintenanceTaskStatus, number> = {
  [MaintenanceTaskStatus.Overdue]: 0,
  [MaintenanceTaskStatus.DueSoon]: 1,
  [MaintenanceTaskStatus.Ok]: 2,
  [MaintenanceTaskStatus.Done]: 3,
};

function byUrgency(a: MaintenanceTaskResponse, b: MaintenanceTaskResponse): number {
  return (
    URGENCY[a.status] - URGENCY[b.status] ||
    (a.remainingFraction ?? Number.POSITIVE_INFINITY) -
      (b.remainingFraction ?? Number.POSITIVE_INFINITY) ||
    a.name.localeCompare(b.name)
  );
}

/**
 * Chooses the tasks for the printable checklist (PDF from the backend). Overdue and soon due tasks are
 * preselected; tasks that are not due yet can be added, e.g. to do them in the same go.
 */
@Component({
  selector: 'app-checklist-dialog',
  imports: [MatDialogModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './checklist-dialog.html',
  styleUrl: './checklist-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistDialog {
  private readonly data = inject<ChecklistDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ChecklistDialog>);
  private readonly tasksService = inject(MaintenanceTasksService);
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly language = inject(LanguageService);

  /** Active tasks that can still be done; one-time tasks that are done are left out. */
  private readonly openTasks = this.data.tasks
    .filter((task) => task.active !== false && task.status !== MaintenanceTaskStatus.Done)
    .sort(byUrgency);

  protected readonly rows = computed(() => {
    const locale = this.language.locale();
    return this.openTasks.map((task) => ({ task, status: computeTaskStatus(task, locale) }));
  });

  protected readonly selected = signal<ReadonlySet<number>>(
    new Set(
      this.openTasks
        .filter(
          (task) =>
            task.status === MaintenanceTaskStatus.Overdue ||
            task.status === MaintenanceTaskStatus.DueSoon,
        )
        .map((task) => task.id),
    ),
  );
  protected readonly creating = signal(false);
  protected readonly errorKey = signal<string | null>(null);

  protected toggle(taskId: number): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (!next.delete(taskId)) {
        next.add(taskId);
      }
      return next;
    });
  }

  protected create(): void {
    // In list order, so the request reads like the checklist; the backend sorts again anyway.
    const taskIds = this.openTasks.map((task) => task.id).filter((id) => this.selected().has(id));
    if (!taskIds.length) {
      return;
    }
    this.creating.set(true);
    this.errorKey.set(null);
    this.tasksService
      .downloadMaintenanceChecklist(this.data.vehicleId, taskIds, 'response')
      .subscribe({
        next: (response) => {
          const fallback = this.transloco.translate(
            'checklist.fallbackFileName',
            {},
            this.language.lang(),
          );
          saveFile(response, fallback, this.document);
          this.dialogRef.close();
        },
        error: (error: unknown) => {
          this.creating.set(false);
          this.errorKey.set(
            error instanceof HttpErrorResponse && error.status === 400
              ? 'checklist.errors.invalid'
              : 'checklist.errors.unknown',
          );
        },
      });
  }
}
