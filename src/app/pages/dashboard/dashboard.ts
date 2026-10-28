import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MaintenanceLogsService, MaintenanceTasksService, VehiclesService } from '../../api-client';
import { LanguageService } from '../../i18n/language';
import { LocalDatePipe, LocalNumberPipe } from '../../i18n/localized-pipes';
import { vehicleIcon, vehicleSubtitle } from '../../shared/vehicle-format';
import { computeTaskStatus } from '../vehicle-detail/maintenance-status';
import { resolveTaskIcon } from '../vehicle-detail/task-icon';

/** How many due tasks are shown per vehicle before collapsing into "+N more". */
const DUE_TASKS_PER_VEHICLE = 3;

/** How many task names from the last log are shown before collapsing into "+N more". */
const LAST_LOG_TASK_NAMES_SHOWN = 3;

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    LocalDatePipe,
    LocalNumberPipe,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly vehiclesService = inject(VehiclesService);
  private readonly tasksService = inject(MaintenanceTasksService);
  private readonly logsService = inject(MaintenanceLogsService);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);

  protected readonly vehicleIcon = vehicleIcon;
  protected readonly vehicleSubtitle = vehicleSubtitle;

  protected readonly data = rxResource({
    stream: () =>
      this.vehiclesService.listVehicles().pipe(
        switchMap((vehicles) => {
          if (!vehicles.length) {
            return of([]);
          }
          return forkJoin(
            vehicles.map((vehicle) =>
              forkJoin({
                tasks: this.tasksService.listMaintenanceTasks(vehicle.id!),
                logs: this.logsService.listMaintenanceLogs(vehicle.id!),
              }).pipe(map(({ tasks, logs }) => ({ vehicle, tasks, logs }))),
            ),
          );
        }),
      ),
  });

  protected readonly vehicleSummaries = computed(() => {
    const vehicleData = this.data.value();
    if (!vehicleData) {
      return [];
    }
    // Reading the language signals makes this recompute on a language switch; translations of the new
    // language are already loaded by then (see LanguageService.use).
    const locale = this.language.locale();
    const lang = this.language.lang();
    const t = (key: string, params?: Record<string, number>) =>
      this.transloco.translate(key, params ?? {}, lang);
    const summaries = vehicleData.map((entry) => {
      const taskNames = new Map(
        entry.tasks.map((task) => [task.id, task.name ?? t('task.unnamed')]),
      );
      const lastLog = [...entry.logs].sort((a, b) =>
        (b.performedAt ?? '').localeCompare(a.performedAt ?? ''),
      )[0];
      const lastLogNames = lastLog
        ? (lastLog.performedTaskIds ?? []).map((id) => taskNames.get(id) ?? t('task.unknown'))
        : [];

      const dueTasks = entry.tasks
        .filter((task) => task.active !== false)
        .map((task) => ({
          task,
          icon: resolveTaskIcon(task.name),
          status: computeTaskStatus(task, locale),
        }))
        .filter((card) => card.status.state === 'overdue' || card.status.state === 'due-soon')
        .sort((a, b) => (a.status.remainingFraction ?? 0) - (b.status.remainingFraction ?? 0));

      const shownLastLogNames = lastLogNames.slice(0, LAST_LOG_TASK_NAMES_SHOWN);
      const lastLogNamesOverflow = Math.max(0, lastLogNames.length - LAST_LOG_TASK_NAMES_SHOWN);
      const lastLogTitle = shownLastLogNames.length
        ? shownLastLogNames.join(', ') +
          (lastLogNamesOverflow > 0
            ? ' ' + t('common.moreCount', { count: lastLogNamesOverflow })
            : '')
        : t('dashboard.maintenanceFallback');

      return {
        vehicle: entry.vehicle,
        lastLog: lastLog ? { log: lastLog, title: lastLogTitle } : null,
        dueTasks: dueTasks.slice(0, DUE_TASKS_PER_VEHICLE),
        dueTasksOverflow: Math.max(0, dueTasks.length - DUE_TASKS_PER_VEHICLE),
        mostUrgentFraction: dueTasks.length ? (dueTasks[0].status.remainingFraction ?? 0) : null,
      };
    });

    return summaries.sort((a, b) => {
      if (a.mostUrgentFraction === null && b.mostUrgentFraction === null) {
        return (a.vehicle.name ?? '').localeCompare(b.vehicle.name ?? '');
      }
      if (a.mostUrgentFraction === null) {
        return 1;
      }
      if (b.mostUrgentFraction === null) {
        return -1;
      }
      return a.mostUrgentFraction - b.mostUrgentFraction;
    });
  });
}
