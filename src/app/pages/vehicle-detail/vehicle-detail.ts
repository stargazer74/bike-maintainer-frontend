import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  input,
  signal,
  WritableSignal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { filter, forkJoin, map, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  Currency,
  MaintenanceLogRequest,
  MaintenanceLogResponse,
  MaintenanceLogsService,
  MaintenanceTaskRequest,
  MaintenanceTaskResponse,
  MaintenanceTasksService,
  MeasurementsService,
  VehicleExportService,
  VehicleRequest,
  VehicleResponse,
  VehiclesService,
  VehicleSpecifications,
  WorksheetsService,
} from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { LanguageService } from '../../i18n/language';
import { LocalCurrencyPipe, LocalDatePipe, LocalNumberPipe } from '../../i18n/localized-pipes';
import { confirmAction } from '../../shared/confirm-dialog/confirm-dialog';
import { saveFile } from '../../shared/download';
import { ChecklistDialog, ChecklistDialogData } from './checklist-dialog/checklist-dialog';
import { WorksheetDialog, WorksheetDialogData } from './worksheet-dialog/worksheet-dialog';
import { CostTile } from './cost-tile/cost-tile';
import { ReportDialog, ReportDialogData } from './report-dialog/report-dialog';
import { MaterialEditor } from './material-editor/material-editor';
import {
  amountError,
  draftTotalCents,
  emptyMaterial,
  MaterialDraft,
  materialDraftError,
  toMaterialRequests,
} from './material-editor/material-draft';
import { NewTaskEditor } from './new-task-editor/new-task-editor';
import {
  fromResponse,
  hasMeasurements,
  MeasurementDrafts,
  measurementsError,
  NO_MEASUREMENTS,
  toMeasurementsRequest,
} from './measurements/measurement-draft';
import { MeasurementEditor } from './measurements/measurement-editor/measurement-editor';
import { MeasurementView, outOfRangeCount } from './measurements/measurement-view/measurement-view';
import {
  SpecificationDialog,
  SpecificationDialogData,
} from './measurements/specification-dialog/specification-dialog';
import { draftError, NewTaskDraft, toNewTaskRequests } from './new-task-editor/new-task-draft';
import { vehicleIcon, vehicleSubtitle } from '../../shared/vehicle-format';
import { VehicleFormDialog } from '../../shared/vehicle-form-dialog/vehicle-form-dialog';
import { computeTaskStatus } from './maintenance-status';
import { describeTaskInterval } from './task-interval';
import { resolveTaskIcon } from './task-icon';

@Component({
  selector: 'app-vehicle-detail',
  imports: [
    LocalCurrencyPipe,
    LocalDatePipe,
    LocalNumberPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    CostTile,
    MaterialEditor,
    MeasurementEditor,
    MeasurementView,
    NewTaskEditor,
    TranslocoPipe,
  ],
  templateUrl: './vehicle-detail.html',
  styleUrl: './vehicle-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleDetail {
  readonly id = input.required<string>();

  private readonly vehiclesService = inject(VehiclesService);
  private readonly tasksService = inject(MaintenanceTasksService);
  private readonly logsService = inject(MaintenanceLogsService);
  private readonly measurementsService = inject(MeasurementsService);
  private readonly worksheetsService = inject(WorksheetsService);
  private readonly vehicleExportService = inject(VehicleExportService);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);
  private readonly authStore = inject(AuthStore);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly language = inject(LanguageService);

  protected readonly vehicleIcon = vehicleIcon;
  protected readonly vehicleSubtitle = vehicleSubtitle;
  protected readonly resolveTaskIcon = resolveTaskIcon;
  protected readonly describeTaskInterval = describeTaskInterval;

  protected readonly data = rxResource({
    params: () => ({ id: Number(this.id()) }),
    stream: ({ params }) =>
      forkJoin({
        vehicle: this.vehiclesService.getVehicle(params.id),
        tasks: this.tasksService.listMaintenanceTasks(params.id),
        logs: this.logsService.listMaintenanceLogs(params.id),
        costSummary: this.logsService.getCostSummary(params.id),
      }),
  });

  /**
   * What the measurement entry needs: the templates of the vehicle type, the target values and the last
   * measurements. Loaded separately, so the page still works if it fails.
   */
  protected readonly measurementContext = rxResource({
    params: () => ({ id: Number(this.id()) }),
    stream: ({ params }) =>
      forkJoin({
        templates: this.worksheetsService
          .listWorksheetTemplates(params.id)
          .pipe(map((templates) => templates.map(({ template }) => template))),
        specification: this.measurementsService.getVehicleSpecifications(params.id),
        latest: this.measurementsService.getLatestMeasurements(params.id),
      }),
  });

  protected readonly outOfRangeCount = outOfRangeCount;

  protected readonly taskCards = computed(() => {
    const result = this.data.value();
    if (!result) {
      return [];
    }
    const locale = this.language.locale();
    return result.tasks
      .filter((task) => task.active !== false)
      .map((task) => ({
        task,
        icon: resolveTaskIcon(task.name),
        status: computeTaskStatus(task, locale),
      }));
  });

  protected readonly logCards = computed(() => {
    const result = this.data.value();
    if (!result) {
      return [];
    }
    // Passing the language signal makes this recompute on a language switch.
    const lang = this.language.lang();
    const unnamed = this.transloco.translate('task.unnamed', {}, lang);
    const unknown = this.transloco.translate('task.unknown', {}, lang);
    const taskNames = new Map(result.tasks.map((task) => [task.id, task.name ?? unnamed]));
    return [...result.logs]
      .sort((a, b) => (b.performedAt ?? '').localeCompare(a.performedAt ?? ''))
      .map((log) => ({
        log,
        taskNames: (log.performedTaskIds ?? []).map((id) => taskNames.get(id) ?? unknown),
      }));
  });

  /** Logs whose cost details are expanded in the history. */
  protected readonly expandedLogIds = signal<ReadonlySet<number>>(new Set());
  /** Logs whose measurements are expanded in the history. */
  protected readonly expandedMeasurementIds = signal<ReadonlySet<number>>(new Set());

  protected toggleLogCosts(logId: number | undefined): void {
    toggle(this.expandedLogIds, logId);
  }

  protected toggleLogMeasurements(logId: number | undefined): void {
    toggle(this.expandedMeasurementIds, logId);
  }

  protected openSpecificationDialog(vehicleId: number): void {
    const templates = this.measurementContext.value()?.templates;
    if (!templates) {
      return;
    }
    this.dialog
      .open<SpecificationDialog, SpecificationDialogData, VehicleSpecifications>(
        SpecificationDialog,
        { autoFocus: 'first-tabbable', data: { vehicleId, templates } },
      )
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          // The history shows measured values checked against the new target values.
          this.measurementContext.reload();
          this.data.reload();
        }
      });
  }

  protected readonly selectedTabIndex = signal(0);

  /** Log whose single report is being downloaded; one at a time. */
  protected readonly downloadingLogId = signal<number | null>(null);
  protected readonly reportErrorKey = signal<string | null>(null);

  protected openChecklistDialog(vehicleId: number, tasks: MaintenanceTaskResponse[]): void {
    this.dialog.open<ChecklistDialog, ChecklistDialogData>(ChecklistDialog, {
      autoFocus: 'first-tabbable',
      data: { vehicleId, tasks },
    });
  }

  protected openWorksheetDialog(vehicleId: number): void {
    this.dialog.open<WorksheetDialog, WorksheetDialogData>(WorksheetDialog, {
      autoFocus: 'first-tabbable',
      data: { vehicleId },
    });
  }

  protected openReportDialog(vehicleId: number): void {
    this.dialog.open<ReportDialog, ReportDialogData>(ReportDialog, {
      autoFocus: 'first-tabbable',
      data: { vehicleId, entries: this.logCards() },
    });
  }

  protected downloadEntryReport(vehicleId: number, logId: number): void {
    if (this.downloadingLogId() !== null) {
      return;
    }
    this.downloadingLogId.set(logId);
    this.reportErrorKey.set(null);
    // Leaving the page cancels the download.
    this.logsService
      .downloadMaintenanceReport(vehicleId, [logId], 'response')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.downloadingLogId.set(null);
          const fallback = this.transloco.translate(
            'report.fallbackFileName',
            {},
            this.language.lang(),
          );
          saveFile(response, fallback, this.document);
        },
        error: (error: unknown) => {
          this.downloadingLogId.set(null);
          this.reportErrorKey.set(
            error instanceof HttpErrorResponse && error.status === 400
              ? 'report.errors.invalid'
              : 'report.errors.unknown',
          );
        },
      });
  }

  protected readonly exporting = signal(false);
  protected readonly exportErrorKey = signal<string | null>(null);

  /** Downloads the vehicle with everything recorded for it as a file that can be imported again (Epic #82). */
  protected exportVehicle(vehicleId: number): void {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);
    this.exportErrorKey.set(null);
    this.vehicleExportService
      .exportVehicle(vehicleId, 'response')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.exporting.set(false);
          const file = new Blob([JSON.stringify(response.body, null, 2)], {
            type: 'application/json',
          });
          const fallback = this.transloco.translate(
            'vehicleDetail.exportFallbackFileName',
            {},
            this.language.lang(),
          );
          saveFile(response.clone<Blob>({ body: file }), fallback, this.document);
        },
        error: () => {
          this.exporting.set(false);
          this.exportErrorKey.set('vehicleDetail.exportError');
        },
      });
  }

  protected openEditVehicleDialog(vehicle: VehicleResponse): void {
    this.dialog
      .open(VehicleFormDialog, { autoFocus: 'first-tabbable', data: { vehicle } })
      .afterClosed()
      .subscribe((updatedVehicle) => {
        if (!updatedVehicle) {
          return;
        }
        this.data.reload();
      });
  }

  protected readonly editingMileage = signal(false);
  protected readonly mileageInput = signal(0);

  protected startEditMileage(vehicle: VehicleResponse): void {
    this.mileageInput.set(vehicle.currentMileage ?? 0);
    this.editingMileage.set(true);
  }

  protected cancelEditMileage(): void {
    this.editingMileage.set(false);
  }

  protected saveMileage(vehicle: VehicleResponse): void {
    if (vehicle.id === undefined || !vehicle.name || !vehicle.type) {
      return;
    }
    const request: VehicleRequest = {
      name: vehicle.name,
      type: vehicle.type,
      make: vehicle.make,
      model: vehicle.model,
      modelYear: vehicle.modelYear,
      firstRegistrationDate: vehicle.firstRegistrationDate,
      currentMileage: this.mileageInput(),
    };
    this.vehiclesService.updateVehicle(vehicle.id, request).subscribe(() => {
      this.editingMileage.set(false);
      this.data.reload();
    });
  }

  protected readonly logDate = signal(todayIso());
  protected readonly logMileage = signal(0);
  protected readonly logNotes = signal('');
  protected readonly logTaskIds = signal<ReadonlySet<number>>(new Set());
  /** Work that becomes new tasks when the log is saved. */
  protected readonly logNewTasks = signal<readonly NewTaskDraft[]>([]);
  protected readonly logShowNewTaskErrors = signal(false);
  protected readonly logMaterials = signal<readonly MaterialDraft[]>([]);
  protected readonly logLaborCost = signal<number | null>(null);
  protected readonly logShowCostErrors = signal(false);
  protected readonly logMeasurements = signal<MeasurementDrafts>(NO_MEASUREMENTS);
  protected readonly logShowMeasurementErrors = signal(false);
  protected readonly editingLogId = signal<number | null>(null);
  /** Currency of the log being edited; a new log uses the one of the user. */
  private readonly editingCurrency = signal<Currency | null>(null);
  protected readonly logCurrency = computed(
    () => this.editingCurrency() ?? this.authStore.currentUser()?.currency ?? Currency.Eur,
  );
  /** The checked tasks (also inactive ones of an edited log) that materials can be assigned to. */
  protected readonly logCheckedTasks = computed(() => {
    const ids = this.logTaskIds();
    const unnamed = this.transloco.translate('task.unnamed', {}, this.language.lang());
    return (this.data.value()?.tasks ?? [])
      .filter((task) => ids.has(task.id))
      .map((task) => ({ id: task.id, name: task.name ?? unnamed }));
  });
  protected readonly logLaborCostError = computed(() => amountError(this.logLaborCost()));
  protected readonly logTotal = computed(() => {
    const cents = draftTotalCents(this.logMaterials(), this.logLaborCost());
    return cents === null ? null : cents / 100;
  });
  protected readonly savingLog = signal(false);
  /** Translation key of the error to show. */
  protected readonly logSubmitError = signal<string | null>(null);

  private readonly logMileageSeeded = signal(false);

  constructor() {
    effect(() => {
      const result = this.data.value();
      if (result && !this.logMileageSeeded()) {
        this.logMileageSeeded.set(true);
        this.logMileage.set(result.vehicle.currentMileage ?? 0);
      }
    });
  }

  protected toggleLogTask(taskId: number | undefined): void {
    if (taskId === undefined) {
      return;
    }
    this.logTaskIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(taskId)) {
        next.delete(taskId);
        this.logMaterials.update((drafts) =>
          drafts.map((draft) => (draft.taskId === taskId ? { ...draft, taskId: null } : draft)),
        );
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  protected startEditLog(log: MaintenanceLogResponse): void {
    this.editingLogId.set(log.id ?? null);
    this.logDate.set(log.performedAt ?? todayIso());
    this.logMileage.set(log.mileageAtPerformed ?? 0);
    this.logNotes.set(log.notes ?? '');
    this.logTaskIds.set(new Set(log.performedTaskIds ?? []));
    this.logNewTasks.set([]);
    this.logShowNewTaskErrors.set(false);
    this.logMaterials.set(
      (log.materials ?? []).map((material) => ({
        ...emptyMaterial(),
        name: material.name,
        partNumber: material.partNumber ?? '',
        quantity: material.quantity,
        unit: material.unit,
        price: material.price ?? null,
        taskId: material.taskId ?? null,
      })),
    );
    this.logLaborCost.set(log.laborCost ?? null);
    this.logShowCostErrors.set(false);
    this.logMeasurements.set(fromResponse(log.measurements));
    this.logShowMeasurementErrors.set(false);
    this.editingCurrency.set(log.currency);
    this.logSubmitError.set(null);
    this.selectedTabIndex.set(2);
  }

  protected cancelLogEdit(): void {
    this.resetLogForm();
  }

  protected submitLog(vehicle: VehicleResponse): void {
    if (this.savingLog() || vehicle.id === undefined || !this.logDate()) {
      return;
    }
    const newTasks = this.logNewTasks();
    if (newTasks.some((draft) => draftError(draft) !== null)) {
      this.logShowNewTaskErrors.set(true);
      this.logSubmitError.set('newTask.errors.fix');
      return;
    }
    if (
      this.logMaterials().some((draft) => materialDraftError(draft) !== null) ||
      this.logLaborCostError()
    ) {
      this.logShowCostErrors.set(true);
      this.logSubmitError.set('logForm.costsInvalid');
      return;
    }
    if (measurementsError(this.logMeasurements()) !== null) {
      this.logShowMeasurementErrors.set(true);
      this.logSubmitError.set('logForm.measurementsInvalid');
      return;
    }
    const materials = this.logMaterials();
    const logId = this.editingLogId();
    const measurements = this.logMeasurements();
    const request: MaintenanceLogRequest = {
      performedAt: this.logDate(),
      mileageAtPerformed: this.logMileage(),
      notes: this.logNotes().trim() || undefined,
      performedTaskIds: [...this.logTaskIds()],
      newTasks: newTasks.length ? toNewTaskRequests(newTasks) : undefined,
      materials: materials.length ? toMaterialRequests(materials) : undefined,
      laborCost: this.logLaborCost() ?? undefined,
      // When editing, always send the measurements, so removed templates are deleted.
      measurements:
        logId !== null || hasMeasurements(measurements)
          ? toMeasurementsRequest(measurements)
          : undefined,
    };
    const request$ =
      logId === null
        ? this.logsService.createMaintenanceLog(vehicle.id, request)
        : this.logsService.updateMaintenanceLog(vehicle.id, logId, request);

    this.savingLog.set(true);
    this.logSubmitError.set(null);
    request$.subscribe({
      next: () => {
        this.savingLog.set(false);
        this.resetLogForm();
        this.data.reload();
        this.measurementContext.reload();
      },
      error: () => {
        this.savingLog.set(false);
        this.logSubmitError.set('logForm.saveError');
      },
    });
  }

  protected deleteLog(vehicle: VehicleResponse, log: MaintenanceLogResponse): void {
    if (vehicle.id === undefined || log.id === undefined) {
      return;
    }
    const vehicleId = vehicle.id;
    const logId = log.id;
    const date = formatIsoDate(log.performedAt, this.language.locale());
    confirmAction(this.dialog, {
      title: 'logForm.deleteTitle',
      message: 'logForm.confirmDelete',
      params: { date },
      confirm: 'common.delete',
    })
      .pipe(
        filter(Boolean),
        switchMap(() => this.logsService.deleteMaintenanceLog(vehicleId, logId)),
      )
      .subscribe(() => {
        if (this.editingLogId() === logId) {
          this.resetLogForm();
        }
        this.data.reload();
        this.measurementContext.reload();
      });
  }

  private resetLogForm(): void {
    this.editingLogId.set(null);
    this.logDate.set(todayIso());
    this.logMileage.set(this.data.value()?.vehicle.currentMileage ?? 0);
    this.logNotes.set('');
    this.logTaskIds.set(new Set());
    this.logNewTasks.set([]);
    this.logShowNewTaskErrors.set(false);
    this.logMaterials.set([]);
    this.logLaborCost.set(null);
    this.logShowCostErrors.set(false);
    this.logMeasurements.set(NO_MEASUREMENTS);
    this.logShowMeasurementErrors.set(false);
    this.editingCurrency.set(null);
    this.logSubmitError.set(null);
  }

  protected readonly taskFormName = signal('');
  protected readonly taskFormDescription = signal('');
  protected readonly taskFormIntervalKm = signal<number | null>(null);
  protected readonly taskFormIntervalMonths = signal<number | null>(null);
  protected readonly taskFormFirstDueKm = signal<number | null>(null);
  protected readonly taskFormFirstDueMonths = signal<number | null>(null);
  protected readonly taskFormOneTime = signal(false);
  protected readonly taskFormActive = signal(true);
  protected readonly editingTaskId = signal<number | null>(null);
  protected readonly savingTask = signal(false);
  /** Translation key of the error to show. */
  protected readonly taskSubmitError = signal<string | null>(null);
  /** Translation key of the error of the last delete attempt, shown above the task list. */
  protected readonly taskDeleteError = signal<string | null>(null);

  protected startEditTask(task: MaintenanceTaskResponse): void {
    this.editingTaskId.set(task.id ?? null);
    this.taskFormName.set(task.name ?? '');
    this.taskFormDescription.set(task.description ?? '');
    this.taskFormIntervalKm.set(task.intervalKm ?? null);
    this.taskFormIntervalMonths.set(task.intervalMonths ?? null);
    this.taskFormFirstDueKm.set(task.firstDueKm ?? null);
    this.taskFormFirstDueMonths.set(task.firstDueMonths ?? null);
    this.taskFormOneTime.set(task.oneTime ?? false);
    this.taskFormActive.set(task.active ?? true);
    this.taskSubmitError.set(null);
  }

  protected cancelTaskEdit(): void {
    this.resetTaskForm();
  }

  protected submitTask(vehicle: VehicleResponse): void {
    const name = this.taskFormName().trim();
    if (this.savingTask() || vehicle.id === undefined || !name) {
      return;
    }
    const request: MaintenanceTaskRequest = {
      name,
      // Always sent: the backend takes every field, a missing description would be deleted (#101).
      description: this.taskFormDescription().trim() || undefined,
      intervalKm: this.taskFormIntervalKm() ?? undefined,
      intervalMonths: this.taskFormIntervalMonths() ?? undefined,
      firstDueKm: this.taskFormFirstDueKm() ?? undefined,
      firstDueMonths: this.taskFormFirstDueMonths() ?? undefined,
      oneTime: this.taskFormOneTime(),
      active: this.taskFormActive(),
    };
    const taskId = this.editingTaskId();
    const request$ =
      taskId === null
        ? this.tasksService.createMaintenanceTask(vehicle.id, request)
        : this.tasksService.updateMaintenanceTask(vehicle.id, taskId, request);

    this.savingTask.set(true);
    this.taskSubmitError.set(null);
    request$.subscribe({
      next: () => {
        this.savingTask.set(false);
        this.resetTaskForm();
        this.data.reload();
      },
      error: () => {
        this.savingTask.set(false);
        this.taskSubmitError.set('taskForm.saveError');
      },
    });
  }

  protected deleteTask(vehicle: VehicleResponse, task: MaintenanceTaskResponse): void {
    if (vehicle.id === undefined || task.id === undefined) {
      return;
    }
    const vehicleId = vehicle.id;
    const taskId = task.id;
    this.taskDeleteError.set(null);
    confirmAction(this.dialog, {
      title: 'taskForm.deleteTitle',
      message: 'taskForm.confirmDelete',
      params: { name: task.name ?? '' },
      confirm: 'common.delete',
    })
      .pipe(
        filter(Boolean),
        switchMap(() => this.tasksService.deleteMaintenanceTask(vehicleId, taskId)),
      )
      .subscribe({
        next: () => {
          if (this.editingTaskId() === taskId) {
            this.resetTaskForm();
          }
          this.data.reload();
        },
        error: (error: unknown) => {
          // 409: the task appears in the history and can only be deactivated.
          this.taskDeleteError.set(
            error instanceof HttpErrorResponse && error.status === 409
              ? 'taskForm.deletePerformed'
              : 'taskForm.deleteError',
          );
        },
      });
  }

  private resetTaskForm(): void {
    this.editingTaskId.set(null);
    this.taskFormName.set('');
    this.taskFormDescription.set('');
    this.taskFormIntervalKm.set(null);
    this.taskFormIntervalMonths.set(null);
    this.taskFormFirstDueKm.set(null);
    this.taskFormFirstDueMonths.set(null);
    this.taskFormOneTime.set(false);
    this.taskFormActive.set(true);
    this.taskSubmitError.set(null);
  }
}

/** Adds the id to the set, or removes it if it is already there. */
function toggle(ids: WritableSignal<ReadonlySet<number>>, id: number | undefined): void {
  if (id === undefined) {
    return;
  }
  ids.update((current) => {
    const next = new Set(current);
    if (!next.delete(id)) {
      next.add(id);
    }
    return next;
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatIsoDate(iso: string | undefined, locale: string): string {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime())
    ? formatDate(date, 'mediumDate', locale)
    : (iso ?? '');
}
