import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaintenanceTaskResponse, MaintenanceTaskStatus } from '../../../api-client';
import { translocoTesting } from '../../../i18n/testing';
import '../../../i18n/i18n.config';
import { ChecklistDialog, ChecklistDialogData } from './checklist-dialog';

const CHECKLIST_URL = 'http://localhost/api/v1/vehicles/7/maintenance-checklist';

function task(
  id: number,
  name: string,
  status: MaintenanceTaskStatus,
  extra: Partial<MaintenanceTaskResponse> = {},
): MaintenanceTaskResponse {
  return { id, vehicleId: 7, name, oneTime: false, active: true, status, ...extra };
}

const TASKS: MaintenanceTaskResponse[] = [
  task(1, 'Bremsflüssigkeit', MaintenanceTaskStatus.Ok, {
    remainingFraction: 0.1,
    kmRemaining: 200,
  }),
  task(2, 'Ölwechsel', MaintenanceTaskStatus.Overdue, {
    remainingFraction: -0.05,
    kmRemaining: -300,
  }),
  task(3, 'Kette spannen', MaintenanceTaskStatus.DueSoon, {
    remainingFraction: 0.04,
    daysRemaining: 12,
  }),
  task(4, 'Luftfilter', MaintenanceTaskStatus.Ok, { remainingFraction: 0.6, kmRemaining: 6000 }),
  task(5, 'Erstinspektion', MaintenanceTaskStatus.Done, { oneTime: true }),
  task(6, 'Alt', MaintenanceTaskStatus.Ok, { active: false }),
];

describe('ChecklistDialog', () => {
  let fixture: ComponentFixture<ChecklistDialog>;
  let httpMock: HttpTestingController;
  const close = vi.fn();

  function create(tasks: MaintenanceTaskResponse[] = TASKS): void {
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { vehicleId: 7, tasks } satisfies ChecklistDialogData,
        },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ChecklistDialog);
    fixture.detectChanges();
  }

  beforeEach(() => close.mockReset());
  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  function page(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function rows(): { name: string; checked: boolean; label: string }[] {
    return [...page().querySelectorAll<HTMLElement>('.checklist__row')].map((row) => ({
      name: row.querySelector('.checklist__name')!.textContent!.trim(),
      checked: row.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked,
      label: row.querySelector('.checklist__due')!.textContent!.trim(),
    }));
  }

  function createButton(): HTMLButtonElement {
    return page().querySelector<HTMLButtonElement>('.checklist__create')!;
  }

  it('lists open tasks by urgency with overdue and soon due ones preselected', () => {
    create();

    expect(rows()).toEqual([
      { name: 'Ölwechsel', checked: true, label: expect.stringContaining('300') },
      { name: 'Kette spannen', checked: true, label: expect.stringContaining('12') },
      { name: 'Bremsflüssigkeit', checked: false, label: expect.stringContaining('200') },
      { name: 'Luftfilter', checked: false, label: expect.stringContaining('6.000') },
    ]);
    expect(page().textContent).toContain('2 ausgewählt');
  });

  it('downloads the PDF for the selected tasks and closes', async () => {
    create();
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue('blob:x'),
      revokeObjectURL: vi.fn(),
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    page().querySelectorAll<HTMLInputElement>('input[type=checkbox]')[2].click();
    fixture.detectChanges();

    createButton().click();
    const request = httpMock.expectOne((req) => req.url === CHECKLIST_URL);
    expect(request.request.params.getAll('taskId')).toEqual(['2', '3', '1']);
    request.flush(new Blob(['%PDF-']), {
      headers: { 'Content-Disposition': 'attachment; filename="checkliste.pdf"' },
    });
    await fixture.whenStable();

    expect(click).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('cannot create a PDF without a selected task', () => {
    create();
    page()
      .querySelectorAll<HTMLInputElement>('input[type=checkbox]:checked')
      .forEach((box) => box.click());
    fixture.detectChanges();

    expect(createButton().disabled).toBe(true);
  });

  it('says so when there is nothing to print', () => {
    create([task(5, 'Erstinspektion', MaintenanceTaskStatus.Done, { oneTime: true })]);

    expect(page().textContent).toContain('Es gibt keine offenen Aufgaben');
    expect(createButton().disabled).toBe(true);
  });

  it.each([
    [400, 'bitte lade die Seite neu'],
    [500, 'Die Checkliste konnte nicht erstellt werden'],
  ])('shows an error for %s and stays open', async (status, message) => {
    create();
    createButton().click();
    httpMock
      .expectOne((req) => req.url === CHECKLIST_URL)
      .flush(new Blob(['{}']), { status, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(page().querySelector('.checklist__error')?.textContent).toContain(message);
    expect(close).not.toHaveBeenCalled();
    expect(createButton().disabled).toBe(false);
  });
});
