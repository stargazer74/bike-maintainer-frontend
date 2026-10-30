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
  VehicleResponse,
  VehicleType,
} from '../../api-client';
import { AuthStore } from '../../auth/auth-store';
import { translocoTesting } from '../../i18n/testing';
import '../../i18n/i18n.config';
import { VehicleDetail } from './vehicle-detail';

const BASE = 'http://localhost/api/v1/vehicles/7';

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
    await fixture.whenStable();
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

  it('explains why an already performed task cannot be deleted', async () => {
    const chainLube: MaintenanceTaskResponse = {
      id: 9,
      vehicleId: 7,
      name: 'Kette schmieren',
      oneTime: false,
      active: true,
      intervalKm: 1000,
      status: MaintenanceTaskStatus.Ok,
    };
    await render([], [chainLube]);
    vi.spyOn(fixture.debugElement.injector.get(MatDialog), 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as ReturnType<MatDialog['open']>);
    await openTab(3);

    page()
      .querySelector<HTMLButtonElement>('.tasks-manage__item-actions button:last-child')!
      .click();
    httpMock
      .expectOne((req) => req.method === 'DELETE' && req.url === `${BASE}/maintenance-tasks/9`)
      .flush(null, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(page().querySelector('.tasks-manage__error')?.textContent).toContain(
      'kann deshalb nicht gelöscht werden',
    );
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
});
