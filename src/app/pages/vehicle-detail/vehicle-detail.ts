import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import {
  MaintenanceLogsService,
  MaintenanceTasksService,
  VehicleRequest,
  VehicleResponse,
  VehiclesService,
} from '../../api-client';
import { vehicleIcon, vehicleSubtitle } from '../../shared/vehicle-format';
import { computeTaskStatus } from './maintenance-status';
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

  protected readonly vehicleIcon = vehicleIcon;
  protected readonly vehicleSubtitle = vehicleSubtitle;

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
    const mileage = result.vehicle.currentMileage ?? 0;
    return result.tasks
      .filter((task) => task.active !== false)
      .map((task) => ({
        task,
        icon: resolveTaskIcon(task.name),
        status: computeTaskStatus(task, mileage, result.logs),
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
      currentMileage: this.mileageInput(),
    };
    this.vehiclesService.updateVehicle(vehicle.id, request).subscribe(() => {
      this.editingMileage.set(false);
      this.data.reload();
    });
  }
}
