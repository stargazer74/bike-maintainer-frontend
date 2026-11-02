import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import {
  Currency,
  MaintenanceLogResponse,
  MaintenanceTaskResponse,
  MaintenanceTaskStatus,
  VehicleResponse,
  VehicleType,
} from '../../api-client';
import { translocoTesting } from '../../i18n/testing';
import '../../i18n/i18n.config';
import { Dashboard } from './dashboard';

const API = 'http://localhost/api/v1/vehicles';

function vehicle(id: number, name: string): VehicleResponse {
  return {
    id,
    name,
    type: VehicleType.Motorcycle,
    currentMileage: 10000 * id,
    createdAt: '2026-01-01T00:00:00Z',
  } as VehicleResponse;
}

function task(
  id: number,
  name: string,
  status: MaintenanceTaskStatus,
  remainingFraction: number,
  active = true,
): MaintenanceTaskResponse {
  return {
    id,
    vehicleId: 1,
    name,
    oneTime: false,
    active,
    intervalKm: 1000,
    kmRemaining: Math.round(1000 * remainingFraction),
    remainingFraction,
    status,
  };
}

function log(id: number, performedAt: string, performedTaskIds: number[]): MaintenanceLogResponse {
  return {
    id,
    vehicleId: 1,
    performedAt,
    mileageAtPerformed: 1000,
    performedTaskIds,
    materials: [],
    currency: Currency.Eur,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

/** Lets the pending requests go out; `whenStable` would wait for their responses. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let httpMock: HttpTestingController;

  async function start(): Promise<void> {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Dashboard);
    fixture.autoDetectChanges();
    await tick();
  }

  async function render(
    vehicles: {
      vehicle: VehicleResponse;
      tasks: MaintenanceTaskResponse[];
      logs: MaintenanceLogResponse[];
    }[],
  ): Promise<void> {
    await start();
    httpMock.expectOne(API).flush(vehicles.map((entry) => entry.vehicle));
    await tick();
    for (const entry of vehicles) {
      httpMock.expectOne(`${API}/${entry.vehicle.id}/maintenance-tasks`).flush(entry.tasks);
      httpMock.expectOne(`${API}/${entry.vehicle.id}/maintenance-logs`).flush(entry.logs);
    }
    await fixture.whenStable();
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function names(): string[] {
    return [...page().querySelectorAll('.vehicle-summary__name')].map((name) =>
      name.textContent!.trim(),
    );
  }

  afterEach(() => httpMock.verify());

  it('says so when there are no vehicles', async () => {
    await render([]);

    expect(page().querySelector('.stub-card')!.textContent).toContain(
      'Noch keine Fahrzeuge erfasst.',
    );
  });

  it('shows an error when the vehicles cannot be loaded', async () => {
    await start();
    httpMock.expectOne(API).flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(page().textContent).toContain('Daten konnten nicht geladen werden.');
  });

  it('puts the most urgent vehicle first and vehicles without due tasks by name', async () => {
    await render([
      { vehicle: vehicle(1, 'Zephyr'), tasks: [], logs: [] },
      { vehicle: vehicle(2, 'Africa Twin'), tasks: [], logs: [] },
      {
        vehicle: vehicle(3, 'Bandit'),
        tasks: [task(31, 'Ölwechsel', MaintenanceTaskStatus.DueSoon, 0.4)],
        logs: [],
      },
      {
        vehicle: vehicle(4, 'Ténéré'),
        tasks: [task(41, 'Kette spannen', MaintenanceTaskStatus.Overdue, -0.2)],
        logs: [],
      },
    ]);

    expect(names()).toEqual(['Ténéré', 'Bandit', 'Africa Twin', 'Zephyr']);
    expect(page().querySelectorAll('.vehicle-summary__block-empty--ok')).toHaveLength(2);
  });

  it('lists at most three due tasks, most urgent first, and skips inactive and ok ones', async () => {
    await render([
      {
        vehicle: vehicle(1, 'Bandit'),
        tasks: [
          task(1, 'Bremsen', MaintenanceTaskStatus.DueSoon, 0.5),
          task(2, 'Ölwechsel', MaintenanceTaskStatus.Overdue, -0.1),
          task(3, 'Kette', MaintenanceTaskStatus.DueSoon, 0.3),
          task(4, 'Reifen', MaintenanceTaskStatus.DueSoon, 0.6),
          task(5, 'Luftfilter', MaintenanceTaskStatus.DueSoon, 0.7),
          task(6, 'Inaktiv', MaintenanceTaskStatus.Overdue, -0.9, false),
          task(7, 'Ventile', MaintenanceTaskStatus.Ok, 0.9),
        ],
        logs: [],
      },
    ]);

    const due = [...page().querySelectorAll('.vehicle-summary__due-name')].map((name) =>
      name.textContent!.trim(),
    );
    expect(due).toEqual(['Ölwechsel', 'Kette', 'Bremsen']);
    expect(page().querySelector('.vehicle-summary__due-overflow')!.textContent).toContain(
      '+2 weitere',
    );
    expect(page().textContent).toContain('Noch keine Wartung erfasst');
  });

  it('names the tasks of the latest log, with a fallback for unknown and missing tasks', async () => {
    await render([
      {
        vehicle: vehicle(1, 'Bandit'),
        tasks: [
          task(1, 'Ölwechsel', MaintenanceTaskStatus.Ok, 0.9),
          task(2, 'Kette', MaintenanceTaskStatus.Ok, 0.9),
          task(3, 'Bremsen', MaintenanceTaskStatus.Ok, 0.9),
          task(4, 'Reifen', MaintenanceTaskStatus.Ok, 0.9),
        ],
        logs: [log(1, '2025-01-01', [4]), log(2, '2026-03-01', [1, 2, 99, 3])],
      },
      {
        vehicle: vehicle(2, 'Zephyr'),
        tasks: [],
        logs: [log(3, '2026-02-01', [])],
      },
    ]);

    const titles = [...page().querySelectorAll('.vehicle-summary__block-content')].map((title) =>
      title.textContent!.trim(),
    );
    expect(titles).toEqual(['Ölwechsel, Kette, Unbekannte Aufgabe +1 weitere', 'Wartung']);
  });
});
