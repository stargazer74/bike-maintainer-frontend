import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import {
  Currency,
  CostSummaryEntry,
  MaintenanceLogResponse,
  MaintenanceTaskResponse,
  MaintenanceTaskStatus,
  MaterialUnit,
  LatestMeasurementsResponse,
  VehicleResponse,
  VehicleSpecifications,
  VehicleType,
  MeasurementStatus,
  WorksheetTemplate,
} from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { translocoTesting } from '../../i18n/testing';
import '../../i18n/i18n.config';
import { VehicleDetail } from './vehicle-detail';

const BASE = 'http://localhost/api/v1/vehicles/7';

interface MeasurementContext {
  templates?: WorksheetTemplate[];
  specification?: VehicleSpecifications;
  latest?: LatestMeasurementsResponse;
}

const VEHICLE: VehicleResponse = {
  id: 7,
  name: 'Kawasaki VN800',
  type: VehicleType.Motorcycle,
  currentMileage: 42664,
  createdAt: '2026-01-01T00:00:00Z',
} as VehicleResponse;

function log(id: number, performedAt: string): MaintenanceLogResponse {
  return {
    id,
    vehicleId: 7,
    performedAt,
    mileageAtPerformed: 1000 * id,
    performedTaskIds: [],
    materials: [],
    currency: Currency.Eur,
    createdAt: '2026-01-01T00:00:00Z',
  };
}

/** Lets the pending requests go out; `whenStable` would wait for their responses. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}

describe('VehicleDetail', () => {
  let fixture: ComponentFixture<VehicleDetail>;
  let httpMock: HttpTestingController;
  const originalUrl = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

  async function render(
    logs: MaintenanceLogResponse[],
    tasks: MaintenanceTaskResponse[] = [],
    costSummary: CostSummaryEntry[] = [],
    measurementContext: MeasurementContext = {},
  ): Promise<void> {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(VehicleDetail);
    fixture.componentRef.setInput('id', '7');
    fixture.autoDetectChanges();
    await tick();
    httpMock.expectOne(BASE).flush(VEHICLE);
    httpMock.expectOne(`${BASE}/maintenance-tasks`).flush(tasks);
    httpMock.expectOne(`${BASE}/maintenance-logs`).flush(logs);
    httpMock.expectOne(`${BASE}/cost-summary`).flush(costSummary);
    flushMeasurementContext(measurementContext);
    await fixture.whenStable();
  }

  /** Templates, target values and last measurements for the measurement entry. */
  function flushMeasurementContext(context: MeasurementContext = {}): void {
    httpMock
      .expectOne(`${BASE}/worksheets`)
      .flush((context.templates ?? []).map((template) => ({ template })));
    httpMock.expectOne(`${BASE}/specifications`).flush(context.specification ?? {});
    httpMock
      .expectOne(`${BASE}/measurements/latest`)
      .flush(context.latest ?? { measurements: {}, sources: {} });
  }

  async function openHistoryTab(): Promise<void> {
    await openTab(1);
  }

  async function openTab(index: number): Promise<void> {
    page().querySelectorAll<HTMLElement>('[role=tab]')[index].click();
    await fixture.whenStable();
  }

  async function addNewTask(name: string): Promise<void> {
    page().querySelector<HTMLButtonElement>('.new-task__add')!.click();
    await fixture.whenStable();
    const inputs = page().querySelectorAll<HTMLInputElement>('.new-task__name');
    const input = inputs[inputs.length - 1];
    input.value = name;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  function saveLogButton(): HTMLButtonElement {
    return [...page().querySelectorAll<HTMLButtonElement>('.log-form__actions .btn--primary')][0];
  }

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function reportButton(): HTMLButtonElement {
    return page().querySelector<HTMLButtonElement>('.status-section__report')!;
  }

  function downloadButtons(): HTMLButtonElement[] {
    return [...page().querySelectorAll<HTMLButtonElement>('.log-card__download')];
  }

  afterEach(() => {
    httpMock.verify();
    Object.assign(URL, {
      createObjectURL: originalUrl.create,
      revokeObjectURL: originalUrl.revoke,
    });
    vi.restoreAllMocks();
  });

  it('disables the report button with a hint when nothing has been recorded', async () => {
    await render([]);

    expect(reportButton().disabled).toBe(true);
    expect(reportButton().parentElement!.getAttribute('title')).toContain(
      'Noch keine Wartungen erfasst',
    );
  });

  it('opens the report dialog with all entries, newest first', async () => {
    await render([log(1, '2024-05-01'), log(2, '2026-05-01')]);

    expect(reportButton().disabled).toBe(false);
    reportButton().click();
    await fixture.whenStable();

    const dates = [...document.querySelectorAll('.report__date')].map((date) =>
      date.textContent!.trim(),
    );
    expect(dates).toEqual(['01.05.2026', '01.05.2024']);
  });

  it('downloads the report of a single entry from the history', async () => {
    await render([log(1, '2024-05-01'), log(2, '2026-05-01')]);
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue('blob:x'),
      revokeObjectURL: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    await openHistoryTab();

    downloadButtons()[1].click();
    await tick();
    expect(downloadButtons().every((button) => button.disabled)).toBe(true);
    const request = httpMock.expectOne((req) => req.url === `${BASE}/maintenance-report`);
    expect(request.request.params.getAll('logId')).toEqual(['1']);
    request.flush(new Blob(['%PDF-']), {
      headers: { 'Content-Disposition': 'attachment; filename="report.pdf"' },
    });
    await fixture.whenStable();

    expect(click).toHaveBeenCalled();
    expect(downloadButtons().every((button) => !button.disabled)).toBe(true);
  });

  it('exports the vehicle as a readable JSON file', async () => {
    await render([]);
    let saved: Blob | undefined;
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        saved = blob;
        return 'blob:x';
      }),
      revokeObjectURL: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('vehicle-die-rote-2026-11-11.json');
    });
    const button = page().querySelector<HTMLButtonElement>('.vehicle-header__export')!;

    button.click();
    await tick();
    expect(button.disabled).toBe(true);
    httpMock.expectOne(`${BASE}/export`).flush(
      { formatVersion: 1, vehicle: { name: 'Die Rote' } },
      {
        headers: {
          'Content-Disposition': 'attachment; filename="vehicle-die-rote-2026-11-11.json"',
        },
      },
    );
    await fixture.whenStable();

    expect(click).toHaveBeenCalled();
    expect(saved!.type).toBe('application/json');
    expect(JSON.parse(await saved!.text())).toEqual({
      formatVersion: 1,
      vehicle: { name: 'Die Rote' },
    });
    expect(button.disabled).toBe(false);
  });

  it('shows an error when the export fails', async () => {
    await render([]);
    const button = page().querySelector<HTMLButtonElement>('.vehicle-header__export')!;

    button.click();
    await tick();
    httpMock.expectOne(`${BASE}/export`).flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(page().querySelector('.vehicle-header [role=alert]')!.textContent).toContain(
      'Export fehlgeschlagen',
    );
    expect(button.disabled).toBe(false);
  });

  it('cancels the single download when the page is left', async () => {
    await render([log(1, '2024-05-01')]);
    await openHistoryTab();

    downloadButtons()[0].click();
    const request = httpMock.expectOne((req) => req.url === `${BASE}/maintenance-report`);
    fixture.destroy();

    expect(request.cancelled).toBe(true);
  });

  it('shows an error when the single report cannot be created', async () => {
    await render([log(1, '2024-05-01')]);
    await openHistoryTab();

    downloadButtons()[0].click();
    httpMock
      .expectOne((req) => req.url === `${BASE}/maintenance-report`)
      .flush(new Blob(['{}']), { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(page().querySelector('.history-section__error')?.textContent).toContain(
      'Der Bericht konnte nicht erstellt werden',
    );
    expect(downloadButtons()[0].disabled).toBe(false);
  });

  describe('tasks in use (frontend#96)', () => {
    const CHAIN_LUBE: MaintenanceTaskResponse = {
      id: 9,
      vehicleId: 7,
      name: 'Kette schmieren',
      description: 'Kettenspray',
      oneTime: false,
      active: true,
      intervalKm: 1000,
      status: MaintenanceTaskStatus.Ok,
    };

    function answerDialog(result: boolean) {
      return vi
        .spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(result) } as ReturnType<MatDialog['open']>);
    }

    function deleteButton(): HTMLButtonElement {
      return page().querySelector<HTMLButtonElement>(
        '.tasks-manage__item-actions button:last-child',
      )!;
    }

    it('explains instead of asking that a performed task cannot be deleted, and deactivates it', async () => {
      await render(
        [
          { ...log(1, '2026-05-01'), performedTaskIds: [9] },
          { ...log(2, '2026-06-01'), performedTaskIds: [9] },
        ],
        [CHAIN_LUBE],
      );
      const open = answerDialog(true);
      await openTab(3);

      deleteButton().click();

      expect(open.mock.calls[0][1]?.data).toMatchObject({
        variant: 'info',
        message: 'taskForm.inUseMany',
        hint: 'taskForm.inUseHintDeactivate',
        params: { name: 'Kette schmieren', count: 2 },
        action: 'taskForm.deactivate',
      });
      httpMock.expectNone((req) => req.method === 'DELETE');
      const request = httpMock.expectOne(
        (req) => req.method === 'PUT' && req.url === `${BASE}/maintenance-tasks/9`,
      );
      expect(request.request.body).toMatchObject({
        name: 'Kette schmieren',
        description: 'Kettenspray',
        intervalKm: 1000,
        active: false,
      });
      request.flush({ ...CHAIN_LUBE, active: false });
    });

    it('offers no deactivation for a task that is already inactive', async () => {
      await render(
        [{ ...log(1, '2026-05-01'), performedTaskIds: [9] }],
        [{ ...CHAIN_LUBE, active: false }],
      );
      const open = answerDialog(false);
      await openTab(3);

      deleteButton().click();

      expect(open.mock.calls[0][1]?.data).toMatchObject({
        message: 'taskForm.inUseOne',
        hint: 'taskForm.inUseHintInactive',
        action: undefined,
      });
    });

    it('shows the same popup when the backend still answers 409', async () => {
      await render([], [CHAIN_LUBE]);
      const open = answerDialog(true);
      await openTab(3);

      deleteButton().click();
      httpMock
        .expectOne((req) => req.method === 'DELETE' && req.url === `${BASE}/maintenance-tasks/9`)
        .flush(null, { status: 409, statusText: 'Conflict' });
      await tick();
      httpMock
        .match(() => true)
        .forEach((pending) => pending.flush(pending.request.url === BASE ? VEHICLE : []));
      await fixture.whenStable();

      expect(open.mock.calls[1][1]?.data).toMatchObject({
        variant: 'info',
        message: 'taskForm.inUseNow',
      });
      expect(page().querySelector('.tasks-manage__error')).toBeNull();
    });

    it('activates a deactivated task with one click on its card', async () => {
      await render([], [{ ...CHAIN_LUBE, active: false }]);
      await openTab(3);

      const button = page().querySelector<HTMLButtonElement>('.tasks-manage__activate')!;
      expect(button.getAttribute('aria-label')).toBe('Kette schmieren aktivieren');
      button.click();

      const request = httpMock.expectOne(
        (req) => req.method === 'PUT' && req.url === `${BASE}/maintenance-tasks/9`,
      );
      expect(request.request.body).toMatchObject({ name: 'Kette schmieren', active: true });
      request.flush(CHAIN_LUBE);
    });
  });

  it('sends the performed tasks of a new log as a JSON list', async () => {
    const oilChange: MaintenanceTaskResponse = {
      id: 5,
      vehicleId: 7,
      name: 'Ölwechsel',
      oneTime: false,
      active: true,
      intervalKm: 6000,
      status: MaintenanceTaskStatus.Ok,
    };
    await render([], [oilChange]);
    page().querySelectorAll<HTMLElement>('[role=tab]')[2].click();
    await fixture.whenStable();
    page().querySelector<HTMLInputElement>('.log-form__task-option input')!.click();
    await fixture.whenStable();

    page().querySelector<HTMLButtonElement>('.log-form__actions .btn--primary')!.click();
    const request = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url === `${BASE}/maintenance-logs`,
    );
    // What actually goes over the wire: a Set would become {}.
    expect(JSON.parse(JSON.stringify(request.request.body)).performedTaskIds).toEqual([5]);
    request.flush(log(1, '2026-10-30'));
  });

  it('saves new work together with the maintenance log', async () => {
    await render([]);
    await openTab(2);
    await addNewTask('Bremsleitung getauscht');

    saveLogButton().click();
    const request = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url === `${BASE}/maintenance-logs`,
    );
    expect(request.request.body.newTasks).toEqual([
      {
        name: 'Bremsleitung getauscht',
        description: undefined,
        intervalKm: undefined,
        intervalMonths: undefined,
      },
    ]);
    request.flush({ ...log(1, '2026-10-30'), performedTaskIds: [5] });
    await tick();
    httpMock.expectOne(BASE).flush(VEHICLE);
    httpMock.expectOne(`${BASE}/maintenance-tasks`).flush([]);
    httpMock.expectOne(`${BASE}/maintenance-logs`).flush([]);
    httpMock.expectOne(`${BASE}/cost-summary`).flush([]);
    flushMeasurementContext();
    await fixture.whenStable();

    expect(page().querySelectorAll('.new-task')).toHaveLength(0);
  });

  it('does not save while new work is incomplete', async () => {
    await render([]);
    await openTab(2);
    await addNewTask('');

    saveLogButton().click();
    await fixture.whenStable();

    httpMock.expectNone((req) => req.method === 'POST');
    expect(page().textContent).toContain('Bitte vervollständige die weiteren Arbeiten');
    expect(page().querySelector('.new-task__error')?.textContent).toContain(
      'Bitte gib einen Namen ein.',
    );
  });

  const OIL_CHANGE: MaintenanceTaskResponse = {
    id: 5,
    vehicleId: 7,
    name: 'Ölwechsel',
    oneTime: false,
    active: true,
    intervalKm: 6000,
    status: MaintenanceTaskStatus.Ok,
  };

  function setValue(selector: string, value: string, index = 0): Promise<void> {
    const element = page().querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector)[index];
    element.value = value;
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input'));
    return fixture.whenStable();
  }

  async function addMaterial(name: string, price: string): Promise<void> {
    page().querySelector<HTMLButtonElement>('.material__add')!.click();
    await fixture.whenStable();
    const index = page().querySelectorAll('.material').length - 1;
    await setValue('.material__name', name, index);
    await setValue('.material__price', price, index);
  }

  function checkFirstTask(): Promise<void> {
    page().querySelector<HTMLInputElement>('.log-form__task-option input')!.click();
    return fixture.whenStable();
  }

  function costLog(): MaintenanceLogResponse {
    return {
      ...log(1, '2026-05-01'),
      currency: Currency.Chf,
      performedTaskIds: [5],
      materials: [
        {
          name: 'Motoröl 10W-40',
          partNumber: 'MO-1',
          quantity: 3.5,
          unit: MaterialUnit.Liter,
          price: 42.5,
          taskId: 5,
        },
      ],
      laborCost: 80,
      totalCost: 122.5,
    };
  }

  async function signIn(currency: Currency): Promise<void> {
    TestBed.inject(AuthStore).selectProfile(3).subscribe();
    httpMock
      .expectOne((req) => req.url.endsWith('/profiles/3/select'))
      .flush({ id: 3, name: 'Chris', role: 'USER', language: 'de', currency });
    await fixture.whenStable();
  }

  it('uses the currency of the user for a new log', async () => {
    await render([], [OIL_CHANGE]);
    await signIn(Currency.Sek);
    await openTab(2);

    expect(page().querySelector('.log-form__labor .field__label')!.textContent).toContain('SEK');
  });

  it('sends materials and labor cost with the log and shows one overall sum', async () => {
    await render([], [OIL_CHANGE]);
    await openTab(2);
    await checkFirstTask();
    await addMaterial('Motoröl', '42.5');
    await setValue('.material__task', '1: 5');
    await setValue('#log-labor-cost', '80');

    expect(page().querySelector('.log-form__total')?.textContent).toContain('122,50');
    expect(page().querySelector('.material__total')).toBeNull();
    saveLogButton().click();
    const request = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url === `${BASE}/maintenance-logs`,
    );
    expect(request.request.body.materials).toEqual([
      {
        name: 'Motoröl',
        partNumber: undefined,
        quantity: 1,
        unit: MaterialUnit.Piece,
        price: 42.5,
        taskId: 5,
      },
    ]);
    expect(request.request.body.laborCost).toBe(80);
    request.flush(log(1, '2026-10-30'));
  });

  it('clears the task of a material when that task is unchecked', async () => {
    await render([], [OIL_CHANGE]);
    await openTab(2);
    await checkFirstTask();
    await addMaterial('Motoröl', '10');
    await setValue('.material__task', '1: 5');
    expect(
      page().querySelector<HTMLSelectElement>('.material__task')!.selectedOptions[0].text,
    ).toBe('Ölwechsel');

    await checkFirstTask();
    saveLogButton().click();

    const request = httpMock.expectOne(
      (req) => req.method === 'POST' && req.url === `${BASE}/maintenance-logs`,
    );
    expect(request.request.body.materials[0].taskId).toBeUndefined();
    request.flush(log(1, '2026-10-30'));
  });

  it('does not save invalid materials or labor cost', async () => {
    await render([]);
    await openTab(2);
    await addMaterial('Öl', '1.005');
    await setValue('#log-labor-cost', '100000');

    saveLogButton().click();
    await fixture.whenStable();

    httpMock.expectNone((req) => req.method === 'POST');
    expect(page().textContent).toContain('Bitte korrigiere das Material und die Arbeitskosten.');
    expect(page().querySelector('.material__error')?.textContent).toContain('2 Nachkommastellen');
    expect(page().textContent).toContain('höchstens 99.999,99');
  });

  it('edits a log in its own currency with its materials and labor cost', async () => {
    await render([costLog()], [OIL_CHANGE]);
    await signIn(Currency.Eur);
    await openHistoryTab();
    page().querySelector<HTMLButtonElement>('.log-card__actions button:nth-child(2)')!.click();
    await fixture.whenStable();

    expect(page().querySelector<HTMLInputElement>('.material__name')!.value).toBe('Motoröl 10W-40');
    expect(page().querySelector<HTMLInputElement>('#log-labor-cost')!.value).toBe('80');
    expect(page().querySelector('.material__price')!.previousElementSibling!.textContent).toContain(
      'CHF',
    );
    expect(page().querySelector('.log-form__total')?.textContent).toMatch(/122,50\s*CHF/);

    saveLogButton().click();
    const request = httpMock.expectOne(
      (req) => req.method === 'PUT' && req.url === `${BASE}/maintenance-logs/1`,
    );
    expect(request.request.body.materials[0]).toMatchObject({ name: 'Motoröl 10W-40', taskId: 5 });
    expect(request.request.body.laborCost).toBe(80);
    request.flush(costLog());
  });

  it('shows the total of a log in its currency and expands the details', async () => {
    await render([costLog()], [OIL_CHANGE]);
    await openHistoryTab();

    const toggle = page().querySelector<HTMLButtonElement>('.log-card__costs-toggle')!;
    expect(toggle.textContent).toMatch(/122,50\s*CHF/);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(page().querySelector('.log-card__costs-details')).toBeNull();

    toggle.click();
    await fixture.whenStable();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const details = page().querySelector('.log-card__costs-details')!.textContent!;
    expect(details).toContain('Motoröl 10W-40');
    expect(details).toContain('Teilenr. MO-1');
    expect(details).toMatch(/3,5\s*l/);
    expect(details).toMatch(/42,50\s*CHF/);
    expect(details).toMatch(/Arbeitskosten\s*80,00\s*CHF/);
  });

  it('shows the toggle and materials but no total for a log with only unpriced materials', async () => {
    await render([
      {
        ...log(1, '2026-05-01'),
        materials: [{ name: 'Kettenspray', quantity: 1, unit: MaterialUnit.Piece }],
      },
    ]);
    await openHistoryTab();

    const toggle = page().querySelector<HTMLButtonElement>('.log-card__costs-toggle')!;
    expect(toggle).not.toBeNull();
    expect(page().querySelector('.log-card__total')).toBeNull();

    toggle.click();
    await fixture.whenStable();

    expect(page().querySelector('.log-card__costs-details')!.textContent).toContain('Kettenspray');
  });

  it('shows no cost area for a log with neither materials nor labor cost', async () => {
    await render([log(1, '2026-05-01')]);
    await openHistoryTab();

    expect(page().querySelector('.log-card__costs')).toBeNull();
  });

  it('shows the cost summary from the request in the status tab', async () => {
    await render([], [], [{ currency: Currency.Chf, total: 123.4, currentYear: 20 }]);

    const tile = page().querySelector('app-cost-tile')!;
    const text = (tile.textContent ?? '').replace(/\u00a0/g, ' ');
    expect(text).toContain('Kosten');
    expect(text).toContain('123,40 CHF');
    expect(text).toContain('20,00 CHF');
  });

  describe('vehicle header', () => {
    it('saves an edited mileage and reloads the vehicle', async () => {
      await render([]);

      page().querySelector<HTMLButtonElement>('.vehicle-header__stat-edit-btn')!.click();
      await fixture.whenStable();
      const input = page().querySelector<HTMLInputElement>('.vehicle-header__stat-edit input')!;
      expect(Number(input.value)).toBe(42664);
      input.value = '43000';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      page()
        .querySelector<HTMLButtonElement>(
          '.vehicle-header__stat-edit button[aria-label="Speichern"]',
        )!
        .click();

      const request = httpMock.expectOne((req) => req.method === 'PUT' && req.url === BASE);
      expect(request.request.body).toEqual(
        expect.objectContaining({ name: 'Kawasaki VN800', currentMileage: 43000 }),
      );
      request.flush({ ...VEHICLE, currentMileage: 43000 });
      await tick();
      httpMock.expectOne(BASE).flush({ ...VEHICLE, currentMileage: 43000 });
      httpMock.match(() => true).forEach((pending) => pending.flush([]));
      await fixture.whenStable();

      expect(page().querySelector('.vehicle-header__stat-edit')).toBeNull();
      expect(page().querySelector('.vehicle-header__stat-value')!.textContent).toContain('43.000');
    });

    it('discards an edited mileage on cancel', async () => {
      await render([]);

      page().querySelector<HTMLButtonElement>('.vehicle-header__stat-edit-btn')!.click();
      await fixture.whenStable();
      page()
        .querySelector<HTMLButtonElement>(
          '.vehicle-header__stat-edit button[aria-label="Abbrechen"]',
        )!
        .click();
      await fixture.whenStable();

      expect(page().querySelector('.vehicle-header__stat-edit')).toBeNull();
    });

    it('reloads only when the edit dialog returns a vehicle', async () => {
      await render([]);
      const open = vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open');
      open.mockReturnValueOnce({ afterClosed: () => of(undefined) } as ReturnType<
        MatDialog['open']
      >);
      const editButton = page().querySelector<HTMLButtonElement>(
        '.vehicle-header__title-row button',
      )!;

      editButton.click();
      await tick();
      httpMock.expectNone(BASE);

      open.mockReturnValueOnce({ afterClosed: () => of(VEHICLE) } as ReturnType<MatDialog['open']>);
      editButton.click();
      await tick();
      httpMock.expectOne(BASE).flush(VEHICLE);
      httpMock.match(() => true).forEach((pending) => pending.flush([]));
      await fixture.whenStable();
    });
  });

  it('deletes a log after confirmation', async () => {
    await render([log(1, '2026-05-01')]);
    vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as ReturnType<MatDialog['open']>);
    await openHistoryTab();

    page().querySelector<HTMLButtonElement>('button[aria-label="Löschen"]')!.click();
    httpMock
      .expectOne((req) => req.method === 'DELETE' && req.url === `${BASE}/maintenance-logs/1`)
      .flush(null);
    await tick();
    httpMock
      .match(() => true)
      .forEach((pending) => pending.flush(pending.request.url === BASE ? VEHICLE : []));
    await fixture.whenStable();
  });

  describe('further work of a log (backend#127)', () => {
    const MIRROR: MaintenanceTaskResponse = {
      id: 20,
      vehicleId: 7,
      name: 'Spiegel ersetzt',
      oneTime: true,
      active: true,
      createdByLogId: 1,
      status: MaintenanceTaskStatus.Done,
    };
    const SHARED: MaintenanceTaskResponse = { ...MIRROR, id: 21, name: 'Lenker gerichtet' };
    const RETIRED: MaintenanceTaskResponse = {
      id: 22,
      vehicleId: 7,
      name: 'Vergaser synchronisieren',
      oneTime: false,
      active: false,
      intervalKm: 6000,
      status: MaintenanceTaskStatus.Ok,
    };

    function editFirstLog(): void {
      page().querySelector<HTMLButtonElement>('.log-card__actions button:nth-child(2)')!.click();
    }

    it('shows deactivated tasks of an edited log and lets its further work be removed', async () => {
      await render([{ ...log(1, '2026-05-01'), performedTaskIds: [20, 22] }], [MIRROR, RETIRED]);
      await openHistoryTab();
      editFirstLog();
      await fixture.whenStable();

      const options = [...page().querySelectorAll('.log-form__task-option')];
      expect(options.map((option) => option.textContent)).toEqual([
        expect.stringContaining('Vergaser synchronisieren'),
      ]);
      expect(options[0].querySelector('.log-form__task-badge')?.textContent).toContain(
        'deaktiviert',
      );
      expect(page().querySelector('.log-form__further-name')?.textContent).toContain(
        'Spiegel ersetzt',
      );

      page().querySelector<HTMLButtonElement>('.log-form__further-toggle')!.click();
      await fixture.whenStable();
      expect(page().querySelector('.log-form__further-hint')?.textContent).toContain(
        'wird beim Speichern gelöscht',
      );
      expect(page().querySelector('.log-form__further-toggle')?.getAttribute('aria-label')).toBe(
        'Spiegel ersetzt behalten',
      );

      saveLogButton().click();
      const request = httpMock.expectOne(
        (req) => req.method === 'PUT' && req.url === `${BASE}/maintenance-logs/1`,
      );
      expect(request.request.body.performedTaskIds).toEqual([22]);
      request.flush(log(1, '2026-05-01'));
    });

    it('offers no further work and no deactivated task for a new log', async () => {
      await render([{ ...log(1, '2026-05-01'), performedTaskIds: [20, 22] }], [MIRROR, RETIRED]);
      await openTab(2);

      expect(page().querySelector('.log-form__further-work')).toBeNull();
      expect(
        [...page().querySelectorAll('.log-form__task-option')].map((option) => option.textContent),
      ).toEqual([expect.stringContaining('Spiegel ersetzt')]);
    });

    it('names the further work that is deleted with a log', async () => {
      const other = { ...log(2, '2026-06-01'), performedTaskIds: [21] };
      await render(
        [{ ...log(1, '2026-05-01'), performedTaskIds: [20, 21] }, other],
        [MIRROR, SHARED],
      );
      const open = vi
        .spyOn(fixture.debugElement.injector.get(MatDialog), 'open')
        .mockReturnValue({ afterClosed: () => of(false) } as ReturnType<MatDialog['open']>);
      await openHistoryTab();

      // Newest first: the log of 2026-05-01 is the second card.
      page().querySelectorAll<HTMLButtonElement>('button[aria-label="Löschen"]')[1].click();

      expect(open.mock.calls[0][1]?.data).toMatchObject({
        message: 'logForm.confirmDeleteWithWork',
        params: { work: 'Spiegel ersetzt' },
      });
    });
  });

  describe('task management', () => {
    const CHAIN: MaintenanceTaskResponse = {
      id: 9,
      vehicleId: 7,
      name: 'Kette schmieren',
      oneTime: false,
      active: true,
      intervalKm: 1000,
      intervalMonths: 6,
      firstDueKm: 500,
      status: MaintenanceTaskStatus.Ok,
    };

    function taskSubmitButton(): HTMLButtonElement {
      return [...page().querySelectorAll<HTMLButtonElement>('.btn--primary')].find((button) =>
        button.closest('mat-card')?.querySelector('#task-name'),
      )!;
    }

    async function typeTaskName(name: string): Promise<void> {
      const input = page().querySelector<HTMLInputElement>('#task-name')!;
      input.value = name;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    }

    function flushReload(): void {
      httpMock
        .match(() => true)
        .forEach((pending) => pending.flush(pending.request.url === BASE ? VEHICLE : []));
    }

    it('creates a task with the entered name', async () => {
      await render([], []);
      await openTab(3);
      await typeTaskName('  Luftfilter  ');

      taskSubmitButton().click();
      const request = httpMock.expectOne(
        (req) => req.method === 'POST' && req.url === `${BASE}/maintenance-tasks`,
      );
      expect(request.request.body).toEqual(
        expect.objectContaining({ name: 'Luftfilter', oneTime: false, active: true }),
      );
      request.flush({ ...CHAIN, id: 10, name: 'Luftfilter' });
      await tick();
      flushReload();
      await fixture.whenStable();

      expect(page().querySelector<HTMLInputElement>('#task-name')!.value).toBe('');
    });

    it('edits an existing task and keeps the form on a save error', async () => {
      await render([], [CHAIN]);
      await openTab(3);

      page().querySelector<HTMLButtonElement>('.tasks-manage__item-actions button')!.click();
      await fixture.whenStable();
      expect(page().querySelector<HTMLInputElement>('#task-name')!.value).toBe('Kette schmieren');
      await typeTaskName('Kette reinigen');

      taskSubmitButton().click();
      const failed = httpMock.expectOne(
        (req) => req.method === 'PUT' && req.url === `${BASE}/maintenance-tasks/9`,
      );
      expect(failed.request.body).toEqual(
        expect.objectContaining({
          name: 'Kette reinigen',
          intervalKm: 1000,
          intervalMonths: 6,
          firstDueKm: 500,
        }),
      );
      failed.flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
      expect(page().querySelector<HTMLInputElement>('#task-name')!.value).toBe('Kette reinigen');

      taskSubmitButton().click();
      httpMock
        .expectOne((req) => req.method === 'PUT' && req.url === `${BASE}/maintenance-tasks/9`)
        .flush(CHAIN);
      await tick();
      flushReload();
      await fixture.whenStable();
      expect(page().querySelector<HTMLInputElement>('#task-name')!.value).toBe('');
    });

    it('keeps the description of an edited task and lets it be changed or cleared (#101)', async () => {
      await render([], [{ ...CHAIN, description: 'Kettenspray' }]);
      await openTab(3);
      page().querySelector<HTMLButtonElement>('.tasks-manage__item-actions button')!.click();
      await fixture.whenStable();
      const description = page().querySelector<HTMLInputElement>('#task-description')!;
      expect(description.value).toBe('Kettenspray');

      taskSubmitButton().click();
      const unchanged = httpMock.expectOne(
        (req) => req.method === 'PUT' && req.url === `${BASE}/maintenance-tasks/9`,
      );
      expect(unchanged.request.body.description).toBe('Kettenspray');
      unchanged.flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();

      description.value = '  ';
      description.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      taskSubmitButton().click();
      const cleared = httpMock.expectOne(
        (req) => req.method === 'PUT' && req.url === `${BASE}/maintenance-tasks/9`,
      );
      expect(cleared.request.body.description).toBeUndefined();
      cleared.flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();
    });

    it('cancels editing a task', async () => {
      await render([], [CHAIN]);
      await openTab(3);
      page().querySelector<HTMLButtonElement>('.tasks-manage__item-actions button')!.click();
      await fixture.whenStable();

      page()
        .querySelector('#task-name')!
        .closest('mat-card')!
        .querySelector<HTMLButtonElement>('.btn--ghost')!
        .click();
      await fixture.whenStable();

      expect(page().querySelector<HTMLInputElement>('#task-name')!.value).toBe('');
    });

    it('deletes a task after confirmation and resets the form when it was being edited', async () => {
      await render([], [CHAIN]);
      vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(true),
      } as ReturnType<MatDialog['open']>);
      await openTab(3);
      page().querySelector<HTMLButtonElement>('.tasks-manage__item-actions button')!.click();
      await fixture.whenStable();

      page()
        .querySelector<HTMLButtonElement>('.tasks-manage__item-actions button:last-child')!
        .click();
      httpMock
        .expectOne((req) => req.method === 'DELETE' && req.url === `${BASE}/maintenance-tasks/9`)
        .flush(null);
      await tick();
      flushReload();
      await fixture.whenStable();

      expect(page().querySelector<HTMLInputElement>('#task-name')!.value).toBe('');
    });

    it('shows a general error when deleting a task fails otherwise', async () => {
      await render([], [CHAIN]);
      vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of(true),
      } as ReturnType<MatDialog['open']>);
      await openTab(3);

      page()
        .querySelector<HTMLButtonElement>('.tasks-manage__item-actions button:last-child')!
        .click();
      httpMock
        .expectOne((req) => req.method === 'DELETE' && req.url === `${BASE}/maintenance-tasks/9`)
        .flush(null, { status: 500, statusText: 'Server Error' });
      await fixture.whenStable();

      expect(page().querySelector('.tasks-manage__error')).not.toBeNull();
      expect(page().querySelector('.tasks-manage__error')!.textContent).not.toContain(
        'kann deshalb nicht gelöscht werden',
      );
    });
  });
  describe('measurements', () => {
    const BRAKES_ONLY: MeasurementContext = { templates: [WorksheetTemplate.Brakes] };

    function measuredLog(): MaintenanceLogResponse {
      return {
        ...log(1, '2026-05-01'),
        measurements: {
          brakes: {
            padFront: 1.5,
            padRear: 4,
            padFrontStatus: MeasurementStatus.OutOfRange,
            padRearStatus: MeasurementStatus.Ok,
            discFrontStatus: MeasurementStatus.Unknown,
            discRearStatus: MeasurementStatus.Unknown,
          },
        },
      };
    }

    function addTemplate(name: string): Promise<void> {
      [...page().querySelectorAll<HTMLButtonElement>('.measure-add__button')]
        .find((button) => button.textContent!.includes(name))!
        .click();
      return fixture.whenStable();
    }

    it('sends no measurements with a new log when none were added', async () => {
      await render([], [], [], BRAKES_ONLY);
      await openTab(2);

      saveLogButton().click();
      const request = httpMock.expectOne((req) => req.method === 'POST');
      expect(request.request.body.measurements).toBeUndefined();
      request.flush(log(1, '2026-10-30'));
    });

    it('saves the measurements with a new log and reloads the last measurements', async () => {
      await render([], [], [], BRAKES_ONLY);
      await openTab(2);
      await addTemplate('Bremsen');
      const input = page().querySelector<HTMLInputElement>('#measure-pad-front')!;
      input.value = '3.5';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      saveLogButton().click();
      const request = httpMock.expectOne((req) => req.method === 'POST');
      expect(JSON.parse(JSON.stringify(request.request.body.measurements))).toEqual({
        brakes: { padFront: 3.5 },
      });
      request.flush(log(1, '2026-10-30'));
      await tick();
      httpMock.expectOne(BASE).flush(VEHICLE);
      httpMock.expectOne(`${BASE}/maintenance-tasks`).flush([]);
      httpMock.expectOne(`${BASE}/maintenance-logs`).flush([]);
      httpMock.expectOne(`${BASE}/cost-summary`).flush([]);
      flushMeasurementContext(BRAKES_ONLY);
      await fixture.whenStable();

      expect(page().querySelector('.measure-set')).toBeNull();
    });

    it('does not save invalid measurements', async () => {
      await render([], [], [], BRAKES_ONLY);
      await openTab(2);
      await addTemplate('Bremsen');
      const input = page().querySelector<HTMLInputElement>('#measure-pad-front')!;
      input.value = '3.5555';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      saveLogButton().click();
      await fixture.whenStable();

      httpMock.expectNone((req) => req.method === 'POST');
      expect(page().textContent).toContain('Bitte korrigiere die Messwerte.');
      expect(page().textContent).toContain('Höchstens drei Nachkommastellen.');
    });

    it('deletes removed measurements when an edited log is saved', async () => {
      await render([measuredLog()], [], [], BRAKES_ONLY);
      await openHistoryTab();
      page().querySelector<HTMLButtonElement>('.log-card__actions button:nth-child(2)')!.click();
      await fixture.whenStable();

      expect(page().querySelector<HTMLInputElement>('#measure-pad-front')!.value).toBe('1.5');
      page().querySelector<HTMLButtonElement>('.measure-set__remove')!.click();
      await fixture.whenStable();
      saveLogButton().click();

      const request = httpMock.expectOne((req) => req.method === 'PUT');
      expect(JSON.parse(JSON.stringify(request.request.body.measurements))).toEqual({});
      request.flush(log(1, '2026-05-01'));
    });

    it('shows the measurements of a log with the values outside the target', async () => {
      await render([measuredLog()]);
      await openHistoryTab();

      const toggle = page().querySelector<HTMLButtonElement>(
        '.log-card__measurements .log-card__costs-toggle',
      )!;
      expect(toggle.textContent).toContain('Messwerte');
      expect(toggle.textContent).toContain('1 außerhalb Soll');
      expect(page().querySelector('app-measurement-view')).toBeNull();

      toggle.click();
      await fixture.whenStable();

      expect(page().querySelector('app-measurement-view')!.textContent).toContain('Belag vorne');
    });

    it('offers the target values only if the vehicle has templates', async () => {
      await render([]);
      expect(page().querySelector('.status-section__specification')).toBeNull();
    });

    it('reloads the page after the target values were saved', async () => {
      await render([], [], [], BRAKES_ONLY);
      const open = vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({
        afterClosed: () => of({ brakePadMinFront: 2 }),
      } as never);

      page().querySelector<HTMLButtonElement>('.status-section__specification')!.click();
      await tick();

      expect(open.mock.calls[0][1]!.data).toEqual({
        vehicleId: 7,
        templates: [WorksheetTemplate.Brakes],
      });
      httpMock.expectOne(BASE).flush(VEHICLE);
      httpMock.expectOne(`${BASE}/maintenance-tasks`).flush([]);
      httpMock.expectOne(`${BASE}/maintenance-logs`).flush([]);
      httpMock.expectOne(`${BASE}/cost-summary`).flush([]);
      flushMeasurementContext(BRAKES_ONLY);
      await fixture.whenStable();
    });
  });
});
