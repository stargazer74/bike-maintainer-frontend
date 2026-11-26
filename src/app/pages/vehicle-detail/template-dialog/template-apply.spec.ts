import {
  VehicleResponse,
  VehicleTemplateResponse,
  VehicleTemplateTaskResponse,
} from '../../../api-client';
import {
  fillEmpty,
  initialRows,
  reportUrl,
  TemplateTaskRow,
  toApplyRequest,
} from './template-apply';

const TODAY = '2026-11-26';

function task(
  key: string,
  extra: Partial<VehicleTemplateTaskResponse> = {},
): VehicleTemplateTaskResponse {
  return { key, name: key, oneTime: false, sourceIds: [], details: [], ...extra };
}

function template(...tasks: VehicleTemplateTaskResponse[]): VehicleTemplateResponse {
  return { id: 'honda-cb650r-2019', tasks } as unknown as VehicleTemplateResponse;
}

const vehicle = { currentMileage: 40000, firstRegistrationDate: '2024-11-20' } as VehicleResponse;

describe('initialRows', () => {
  it('selects all tasks by default', () => {
    const rows = initialRows(template(task('a'), task('b')), new Set(), vehicle, TODAY);
    expect(rows.map((r) => r.selected)).toEqual([true, true]);
    expect(rows.every((r) => !r.existing && r.lastDoneKm === null && r.lastDoneDate === null)).toBe(
      true,
    );
  });

  it('marks existing keys as existing and unselected', () => {
    const rows = initialRows(template(task('a'), task('b')), new Set(['a']), vehicle, TODAY);
    expect(rows[0]).toMatchObject({ existing: true, selected: false });
    expect(rows[1]).toMatchObject({ existing: false, selected: true });
  });

  it('deselects a one-time task whose first due km is already passed', () => {
    const rows = initialRows(
      template(task('a', { oneTime: true, firstDueKm: 1000 })),
      new Set(),
      vehicle,
      TODAY,
    );
    expect(rows[0].selected).toBe(false);
  });

  it('deselects a one-time task whose first due months are already passed', () => {
    const rows = initialRows(
      template(task('a', { oneTime: true, firstDueMonths: 6 })),
      new Set(),
      { currentMileage: 10, firstRegistrationDate: '2024-11-26' } as VehicleResponse,
      TODAY,
    );
    expect(rows[0].selected).toBe(false);
  });

  it('keeps a one-time task selected while its first due is still ahead', () => {
    const rows = initialRows(
      template(task('a', { oneTime: true, firstDueKm: 50000, firstDueMonths: 36 })),
      new Set(),
      vehicle,
      TODAY,
    );
    expect(rows[0].selected).toBe(true);
  });

  it('keeps a recurring task selected even if first due has passed', () => {
    const rows = initialRows(template(task('a', { firstDueKm: 1000 })), new Set(), vehicle, TODAY);
    expect(rows[0].selected).toBe(true);
  });

  it('treats a first due exactly today as passed and handles month ends', () => {
    const v = { currentMileage: 0, firstRegistrationDate: '2025-08-31' } as VehicleResponse;
    const passed = initialRows(
      template(task('a', { oneTime: true, firstDueMonths: 3 })),
      new Set(),
      v,
      '2025-11-30',
    );
    const ahead = initialRows(
      template(task('a', { oneTime: true, firstDueMonths: 3 })),
      new Set(),
      v,
      '2025-11-29',
    );
    expect(passed[0].selected).toBe(false);
    expect(ahead[0].selected).toBe(true);
  });
});

describe('fillEmpty', () => {
  const row = (key: string, extra: Partial<TemplateTaskRow> = {}): TemplateTaskRow => ({
    task: task(key),
    selected: true,
    existing: false,
    lastDoneKm: null,
    lastDoneDate: null,
    ...extra,
  });

  it('fills only empty fields and keeps set values', () => {
    const rows = [
      row('a', { lastDoneKm: 100 }),
      row('b', { lastDoneDate: '2026-01-01' }),
      row('c'),
    ];
    const result = fillEmpty(rows, vehicle, TODAY);
    expect(result.map((r) => [r.lastDoneKm, r.lastDoneDate])).toEqual([
      [100, TODAY],
      [40000, '2026-01-01'],
      [40000, TODAY],
    ]);
  });

  it('leaves existing rows untouched and returns new objects', () => {
    const rows = [row('a', { existing: true, selected: false }), row('b')];
    const result = fillEmpty(rows, vehicle, TODAY);
    expect(result[0]).toEqual(rows[0]);
    expect(result[0]).not.toBe(rows[0]);
    expect(result[1]).not.toBe(rows[1]);
    expect(rows[1].lastDoneKm).toBeNull();
  });

  it('keeps a first due point that is still ahead empty', () => {
    const fresh = { currentMileage: 300, firstRegistrationDate: '2026-09-01' } as VehicleResponse;
    const rows = [
      row('run-in', { task: task('run-in', { firstDueKm: 1000, intervalKm: 12000 }) }),
      row('by-time', { task: task('by-time', { firstDueMonths: 12, intervalMonths: 12 }) }),
      row('plain', { task: task('plain', { intervalKm: 6000 }) }),
    ];
    const result = fillEmpty(rows, fresh, TODAY);
    expect(result.map((r) => [r.lastDoneKm, r.lastDoneDate])).toEqual([
      [null, null],
      [null, null],
      [300, TODAY],
    ]);
  });

  it('fills a row once either first due axis is reached', () => {
    const rows = [
      row('km-reached', { task: task('km-reached', { firstDueKm: 1000, firstDueMonths: 120 }) }),
      row('months-reached', {
        task: task('months-reached', { firstDueKm: 90000, firstDueMonths: 12 }),
      }),
    ];
    const result = fillEmpty(rows, vehicle, TODAY);
    expect(result.map((r) => r.lastDoneKm)).toEqual([40000, 40000]);
  });
});

describe('toApplyRequest', () => {
  const row = (key: string, extra: Partial<TemplateTaskRow> = {}): TemplateTaskRow => ({
    task: task(key),
    selected: true,
    existing: false,
    lastDoneKm: null,
    lastDoneDate: null,
    ...extra,
  });

  it('includes only selected, non-existing rows and omits empty fields', () => {
    const request = toApplyRequest('t1', [
      row('a'),
      row('b', { lastDoneKm: 500, lastDoneDate: '2026-05-01' }),
      row('c', { selected: false }),
      row('d', { existing: true }),
      row('e', { lastDoneKm: 0 }),
    ]);
    expect(request).toEqual({
      templateId: 't1',
      tasks: [
        { key: 'a' },
        { key: 'b', lastDoneKm: 500, lastDoneDate: '2026-05-01' },
        { key: 'e', lastDoneKm: 0 },
      ],
    });
    expect(Object.keys(request.tasks[0])).toEqual(['key']);
  });
});

describe('reportUrl', () => {
  const base =
    'https://github.com/stargazer74/bike-maintainer-templates/issues/new?template=fehler-in-vorlage.yml';

  it('includes template and task', () => {
    expect(reportUrl('honda-cb650r-2019', 'engine-oil')).toBe(
      `${base}&vorlage=honda-cb650r-2019&aufgabe=engine-oil`,
    );
  });

  it('omits aufgabe without a task and encodes values', () => {
    expect(reportUrl('a b')).toBe(`${base}&vorlage=a%20b`);
    expect(reportUrl('x', 'a&b')).toBe(`${base}&vorlage=x&aufgabe=a%26b`);
  });
});
