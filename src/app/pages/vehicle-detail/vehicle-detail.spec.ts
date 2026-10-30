import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MaintenanceLogResponse, VehicleResponse, VehicleType } from '../../api-client';
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

  async function render(logs: MaintenanceLogResponse[]): Promise<void> {
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
    httpMock.expectOne(`${BASE}/maintenance-tasks`).flush([]);
    httpMock.expectOne(`${BASE}/maintenance-logs`).flush(logs);
    await fixture.whenStable();
  }

  async function openHistoryTab(): Promise<void> {
    page().querySelectorAll<HTMLElement>('[role=tab]')[1].click();
    await fixture.whenStable();
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
});
