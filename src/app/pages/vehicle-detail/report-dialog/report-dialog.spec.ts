import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaintenanceLogResponse } from '../../../api-client';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import { ReportDialog, ReportDialogData, ReportDialogEntry } from './report-dialog';

const REPORT_URL = 'http://localhost/api/v1/vehicles/7/maintenance-report';

function entry(
  id: number,
  performedAt: string,
  mileage: number,
  taskNames: string[],
): ReportDialogEntry {
  const log: MaintenanceLogResponse = {
    id,
    vehicleId: 7,
    performedAt,
    mileageAtPerformed: mileage,
    performedTaskIds: [],
    createdAt: '2026-10-30T08:00:00Z',
  };
  return { log, taskNames };
}

const ENTRIES: ReportDialogEntry[] = [
  entry(3, '2026-05-01', 38300, ['Ventilspiel prüfen']),
  entry(2, '2025-05-23', 38011, ['Bremsflüssigkeit wechseln', 'Batterie prüfen']),
  entry(1, '2023-01-26', 37486, []),
];

describe('ReportDialog', () => {
  let fixture: ComponentFixture<ReportDialog>;
  let httpMock: HttpTestingController;
  const close = vi.fn();

  function create(entries: ReportDialogEntry[] = ENTRIES): void {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { vehicleId: 7, entries } satisfies ReportDialogData,
        },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReportDialog);
    fixture.detectChanges();
  }

  const originalUrl = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

  beforeEach(() => close.mockReset());
  afterEach(() => {
    httpMock.verify();
    Object.assign(URL, {
      createObjectURL: originalUrl.create,
      revokeObjectURL: originalUrl.revoke,
    });
    vi.restoreAllMocks();
  });

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): { text: string; checked: boolean }[] {
    return [...page().querySelectorAll<HTMLElement>('.report__row')].map((row) => ({
      text: ['.report__date', '.report__mileage', '.report__tasks']
        .map((selector) => row.querySelector(selector)?.textContent?.trim())
        .filter(Boolean)
        .join(' '),
      checked: row.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked,
    }));
  }

  function checkboxes(): HTMLInputElement[] {
    return [...page().querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
  }

  function createButton(): HTMLButtonElement {
    return page().querySelector<HTMLButtonElement>('.report__create')!;
  }

  function mockDownload(): ReturnType<typeof vi.spyOn> {
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue('blob:x'),
      revokeObjectURL: vi.fn(),
    });
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  }

  it('lists all entries newest first with date, mileage and tasks, all preselected', () => {
    create();

    expect(rows()).toEqual([
      { text: '01.05.2026 38.300 km Ventilspiel prüfen', checked: true },
      {
        text: '23.05.2025 38.011 km Bremsflüssigkeit wechseln, Batterie prüfen',
        checked: true,
      },
      { text: '26.01.2023 37.486 km', checked: true },
    ]);
    expect(page().textContent).toContain('3 ausgewählt');
  });

  it('selects none and all', () => {
    create();

    page().querySelector<HTMLButtonElement>('.report__none')!.click();
    fixture.detectChanges();
    expect(checkboxes().map((box) => box.checked)).toEqual([false, false, false]);
    expect(createButton().disabled).toBe(true);

    page().querySelector<HTMLButtonElement>('.report__all')!.click();
    fixture.detectChanges();
    expect(checkboxes().map((box) => box.checked)).toEqual([true, true, true]);
    expect(createButton().disabled).toBe(false);
  });

  it('downloads the report for the selected entries and closes', async () => {
    create();
    const click = mockDownload();
    checkboxes()[1].click();
    fixture.detectChanges();

    createButton().click();
    const request = httpMock.expectOne((req) => req.url === REPORT_URL);
    expect(request.request.params.getAll('logId')).toEqual(['3', '1']);
    request.flush(new Blob(['%PDF-']), {
      headers: { 'Content-Disposition': 'attachment; filename="maintenance-report.pdf"' },
    });
    await fixture.whenStable();

    expect(click).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('asks for the full report without IDs when everything is selected', async () => {
    create();
    mockDownload();

    createButton().click();
    const request = httpMock.expectOne((req) => req.url === REPORT_URL);
    expect(request.request.params.has('logId')).toBe(false);
    request.flush(new Blob(['%PDF-']));
    await fixture.whenStable();

    expect(close).toHaveBeenCalled();
  });

  it.each([
    [400, 'bitte lade die Seite neu'],
    [500, 'Der Bericht konnte nicht erstellt werden'],
  ])('shows an error for %s and stays open', async (status, message) => {
    create();
    createButton().click();
    httpMock
      .expectOne((req) => req.url === REPORT_URL)
      .flush(new Blob(['{}']), { status, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page().querySelector('.report__error')?.textContent).toContain(message);
    expect(close).not.toHaveBeenCalled();
    expect(createButton().disabled).toBe(false);
  });
});
