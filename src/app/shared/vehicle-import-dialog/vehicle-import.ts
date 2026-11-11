import { VehicleExport, VehicleType } from '../../api-client';

/** The only file format this version reads and writes (`formatVersion`). */
export const SUPPORTED_FORMAT_VERSION = 1;

/** Same limit as the backend (413 above it); checked first so a huge file is not even read. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** What the dialog shows before the import: enough to recognise the vehicle. */
export interface ImportPreview {
  readonly name: string;
  readonly type: VehicleType | undefined;
  readonly taskCount: number;
  readonly logCount: number;
  readonly exportedAt: string | undefined;
  /** A vehicle of this name exists already; importing creates a second one. */
  readonly nameTaken: boolean;
}

export type ImportFileResult =
  { readonly file: VehicleExport; readonly preview: ImportPreview } | { readonly errorKey: string };

/**
 * Reads a chosen export file far enough for the preview. Everything else (fields, references, limits) is checked by
 * the backend, which lists every problem; this only rejects what is clearly no export file of this version.
 */
export function readImportFile(text: string, existingNames: readonly string[]): ImportFileResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { errorKey: 'vehicleImport.errors.notAnExport' };
  }
  if (
    !isObject(parsed) ||
    typeof parsed['formatVersion'] !== 'number' ||
    !isObject(parsed['vehicle'])
  ) {
    return { errorKey: 'vehicleImport.errors.notAnExport' };
  }
  if (parsed['formatVersion'] !== SUPPORTED_FORMAT_VERSION) {
    return { errorKey: 'vehicleImport.errors.unsupportedVersion' };
  }
  const file = parsed as unknown as VehicleExport;
  const name = typeof file.vehicle.name === 'string' ? file.vehicle.name : '';
  const normalized = name.trim().toLocaleLowerCase();
  return {
    file,
    preview: {
      name,
      type: file.vehicle.type,
      taskCount: Array.isArray(file.vehicle.maintenanceTasks)
        ? file.vehicle.maintenanceTasks.length
        : 0,
      logCount: Array.isArray(file.vehicle.maintenanceLogs)
        ? file.vehicle.maintenanceLogs.length
        : 0,
      exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : undefined,
      nameTaken:
        normalized !== '' &&
        existingNames.some((existing) => existing.trim().toLocaleLowerCase() === normalized),
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
