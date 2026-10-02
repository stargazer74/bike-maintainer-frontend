import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import {
  MaintenanceLogRequest,
  MaintenanceLogResponse,
  MaintenanceLogsService,
  MaintenanceTaskRequest,
  MaintenanceTaskResponse,
  MaintenanceTasksService,
  VehicleRequest,
  VehicleResponse,
  VehiclesService,
} from '../../api-client';
import { vehicleIcon, vehicleSubtitle } from '../../shared/vehicle-format';
import { VehicleFormDialog } from '../../shared/vehicle-form-dialog/vehicle-form-dialog';
import { computeTaskStatus } from './maintenance-status';
import { describeTaskInterval } from './task-interval';
import { resolveTaskIcon } from './task-icon';

@Component({
  selector: 'app-vehicle-detail',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
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
  private readonly dialog = inject(MatDialog);

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
      }),
  });

  protected readonly taskCards = computed(() => {
    const result = this.data.value();
    if (!result) {
      return [];
    }
    return result.tasks
      .filter((task) => task.active !== false)
      .map((task) => ({
        task,
        icon: resolveTaskIcon(task.name),
        status: computeTaskStatus(task),
      }));
  });

  protected readonly logCards = computed(() => {
    const result = this.data.value();
    if (!result) {
      return [];
    }
    const taskNames = new Map(result.tasks.map((task) => [task.id, task.name ?? 'Unbenannte Aufgabe']));
    return [...result.logs]
      .sort((a, b) => (b.performedAt ?? '').localeCompare(a.performedAt ?? ''))
      .map((log) => ({
        log,
        taskNames: (log.performedTaskIds ?? []).map((id) => taskNames.get(id) ?? 'Unbekannte Aufgabe'),
      }));
  });

  protected readonly selectedTabIndex = signal(0);

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
  protected readonly editingLogId = signal<number | null>(null);
  protected readonly savingLog = signal(false);
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
    const request: MaintenanceLogRequest = {
      performedAt: this.logDate(),
      mileageAtPerformed: this.logMileage(),
      notes: this.logNotes().trim() || undefined,
      performedTaskIds: new Set(this.logTaskIds()),
    };
    const logId = this.editingLogId();
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
      },
      error: () => {
        this.savingLog.set(false);
        this.logSubmitError.set('Wartung konnte nicht gespeichert werden. Bitte versuche es erneut.');
      },
    });
  }

  protected deleteLog(vehicle: VehicleResponse, log: MaintenanceLogResponse): void {
    if (vehicle.id === undefined || log.id === undefined) {
      return;
    }
    if (!confirm(`Wartungseintrag vom ${formatDateDe(log.performedAt)} wirklich löschen?`)) {
      return;
    }
    this.logsService.deleteMaintenanceLog(vehicle.id, log.id).subscribe(() => {
      if (this.editingLogId() === log.id) {
        this.resetLogForm();
      }
      this.data.reload();
    });
  }

  private resetLogForm(): void {
    this.editingLogId.set(null);
    this.logDate.set(todayIso());
    this.logMileage.set(this.data.value()?.vehicle.currentMileage ?? 0);
    this.logNotes.set('');
    this.logTaskIds.set(new Set());
    this.logSubmitError.set(null);
  }

  protected readonly taskFormName = signal('');
  protected readonly taskFormIntervalKm = signal<number | null>(null);
  protected readonly taskFormIntervalMonths = signal<number | null>(null);
  protected readonly taskFormFirstDueKm = signal<number | null>(null);
  protected readonly taskFormFirstDueMonths = signal<number | null>(null);
  protected readonly taskFormOneTime = signal(false);
  protected readonly taskFormActive = signal(true);
  protected readonly editingTaskId = signal<number | null>(null);
  protected readonly savingTask = signal(false);
  protected readonly taskSubmitError = signal<string | null>(null);

  protected startEditTask(task: MaintenanceTaskResponse): void {
    this.editingTaskId.set(task.id ?? null);
    this.taskFormName.set(task.name ?? '');
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
        this.taskSubmitError.set('Wartungsaufgabe konnte nicht gespeichert werden. Bitte versuche es erneut.');
      },
    });
  }

  protected deleteTask(vehicle: VehicleResponse, task: MaintenanceTaskResponse): void {
    if (vehicle.id === undefined || task.id === undefined) {
      return;
    }
    if (!confirm(`"${task.name}" wirklich löschen?`)) {
      return;
    }
    this.tasksService.deleteMaintenanceTask(vehicle.id, task.id).subscribe(() => {
      if (this.editingTaskId() === task.id) {
        this.resetTaskForm();
      }
      this.data.reload();
    });
  }

  private resetTaskForm(): void {
    this.editingTaskId.set(null);
    this.taskFormName.set('');
    this.taskFormIntervalKm.set(null);
    this.taskFormIntervalMonths.set(null);
    this.taskFormFirstDueKm.set(null);
    this.taskFormFirstDueMonths.set(null);
    this.taskFormOneTime.set(false);
    this.taskFormActive.set(true);
    this.taskSubmitError.set(null);
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateDe(iso: string | undefined): string {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('de-DE') : (iso ?? '');
}
