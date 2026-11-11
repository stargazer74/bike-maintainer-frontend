import { VehicleType } from '../../api-client';
import { readImportFile } from './vehicle-import';

function file(content: object): string {
  return JSON.stringify(content);
}

const VALID = {
  formatVersion: 1,
  exportedAt: '2026-11-11T10:00:00Z',
  vehicle: {
    name: 'Die Rote',
    type: VehicleType.Motorcycle,
    maintenanceTasks: [
      { ref: 't1', name: 'Öl' },
      { ref: 't2', name: 'Kette' },
    ],
    maintenanceLogs: [{ performedAt: '2026-04-01' }],
  },
};

describe('readImportFile', () => {
  it('summarises an export file for the preview', () => {
    const result = readImportFile(file(VALID), ['Alltag']);

    expect(result).toEqual({
      file: VALID,
      preview: {
        name: 'Die Rote',
        type: VehicleType.Motorcycle,
        taskCount: 2,
        logCount: 1,
        exportedAt: '2026-11-11T10:00:00Z',
        nameTaken: false,
      },
    });
  });

  it('points out a vehicle of the same name, ignoring case and spaces', () => {
    const result = readImportFile(file(VALID), [' die rote ']);

    expect('preview' in result && result.preview.nameTaken).toBe(true);
  });

  it('counts missing lists as empty and leaves unknown fields to the backend', () => {
    const result = readImportFile(file({ formatVersion: 1, vehicle: { name: 42 } }), ['']);

    expect('preview' in result && result.preview).toEqual({
      name: '',
      type: undefined,
      taskCount: 0,
      logCount: 0,
      exportedAt: undefined,
      nameTaken: false,
    });
  });

  it.each([
    ['no JSON', 'not json'],
    ['a JSON array', '[1, 2]'],
    ['no format version', file({ vehicle: {} })],
    ['no vehicle', file({ formatVersion: 1 })],
    ['a vehicle that is no object', file({ formatVersion: 1, vehicle: [] })],
  ])('rejects %s as no export file', (_, text) => {
    expect(readImportFile(text, [])).toEqual({ errorKey: 'vehicleImport.errors.notAnExport' });
  });

  it('rejects a file of another format version', () => {
    expect(readImportFile(file({ ...VALID, formatVersion: 2 }), [])).toEqual({
      errorKey: 'vehicleImport.errors.unsupportedVersion',
    });
  });
});
