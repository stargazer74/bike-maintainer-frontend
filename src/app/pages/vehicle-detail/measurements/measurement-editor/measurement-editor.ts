import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, switchMap, timer } from 'rxjs';
import {
  LatestMeasurementsResponse,
  MaintenanceMeasurementsResponse,
  MeasurementSource,
  MeasurementsService,
  ShimCalculationInput,
  ShimCalculationResult,
  ShimHint,
  ValveAdjustment,
  ValveKind,
  VehicleSpecifications,
  WorksheetTemplate,
} from '../../../../api-client';
import { LocalDatePipe, LocalNumberPipe } from '../../../../i18n/localized-pipes';
import { MeasureField } from '../measure-field/measure-field';
import { stripNulls } from '../strip-nulls';
import {
  BrakeDraft,
  ChainDraft,
  dotError,
  emptyBrakes,
  emptyChain,
  emptyTires,
  layoutOf,
  lengthError,
  linksError,
  MAX_CLEARANCE,
  MAX_LENGTH,
  MAX_SHIM,
  MAX_TREAD,
  MEASUREMENT_KEYS,
  MeasurementDrafts,
  MeasurementKey,
  newValveDrafts,
  pressureError,
  TireDraft,
  ValveDraft,
  valveKey,
  valveLayout,
} from '../measurement-draft';

/** Waits this long after the last keystroke before asking the backend for shim suggestions. */
const SHIM_DEBOUNCE_MS = 300;

/** Templates in the order of the worksheet dialog. */
const TEMPLATE_ORDER: readonly WorksheetTemplate[] = [
  WorksheetTemplate.ValveClearance,
  WorksheetTemplate.Brakes,
  WorksheetTemplate.Chain,
  WorksheetTemplate.Tires,
];

/**
 * Lets the user record the measured values of a maintenance log, one set per worksheet template. Target values
 * of the vehicle and the last measurement are shown as hints; for valve clearance the backend suggests the new
 * shim (live while typing), which can be taken over with one click.
 */
@Component({
  selector: 'app-measurement-editor',
  imports: [
    FormsModule,
    LocalDatePipe,
    LocalNumberPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MeasureField,
    TranslocoPipe,
  ],
  templateUrl: './measurement-editor.html',
  styleUrl: './measurement-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementEditor {
  private readonly measurementsService = inject(MeasurementsService);

  readonly drafts = model.required<MeasurementDrafts>();
  readonly vehicleId = input.required<number>();
  /** Templates that fit the vehicle type. */
  readonly templates = input<readonly WorksheetTemplate[]>([]);
  readonly specification = input(undefined, {
    transform: (value: VehicleSpecifications | undefined) => stripNulls(value),
  });
  readonly latest = input(undefined, {
    transform: (value: LatestMeasurementsResponse | undefined) => stripNulls(value),
  });
  /** Log being edited: its own stored values are not shown as "last measurement". */
  readonly editingLogId = input<number | null>(null);
  /** Shows the problems of invalid values, e.g. after a save attempt. */
  readonly showErrors = input(false);

  protected readonly cylinderOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  protected readonly valveOptions = [2, 3, 4];
  protected readonly maxClearance = MAX_CLEARANCE;
  protected readonly maxShim = MAX_SHIM;
  protected readonly maxLength = MAX_LENGTH;
  protected readonly maxTread = MAX_TREAD;
  protected readonly lengthError = lengthError;
  protected readonly pressureError = pressureError;
  protected readonly linksError = linksError;
  protected readonly dotError = dotError;
  protected readonly intake = ValveKind.Intake;
  protected readonly noChangeNeeded = ShimHint.NoChangeNeeded;
  protected readonly noShimInRange = ShimHint.NoShimInRange;
  protected readonly outsideAvailableSizes = ShimHint.OutsideAvailableSizes;

  /** Templates of the vehicle that are not recorded yet. */
  protected readonly addable = computed(() => {
    const drafts = this.drafts();
    const available = new Set(this.templates());
    return TEMPLATE_ORDER.filter(
      (template) => available.has(template) && drafts[MEASUREMENT_KEYS[template]] === null,
    ).map((template) => ({ template, key: MEASUREMENT_KEYS[template] }));
  });

  /** The last stored measurements, without the log being edited. */
  private readonly previous = computed(() => {
    const latest = this.latest();
    const editing = this.editingLogId();
    const result: {
      measurements: MaintenanceMeasurementsResponse;
      sources: Partial<Record<MeasurementKey, MeasurementSource>>;
    } = { measurements: {}, sources: {} };
    if (!latest) {
      return result;
    }
    for (const key of Object.values(MEASUREMENT_KEYS)) {
      const source = latest.sources[key];
      if (source && source.logId !== editing) {
        result.sources[key] = source;
        Object.assign(result.measurements, { [key]: latest.measurements[key] });
      }
    }
    return result;
  });

  protected readonly previousBrakes = computed(() => this.previous().measurements.brakes);
  protected readonly previousChain = computed(() => this.previous().measurements.chain);
  protected readonly previousTires = computed(() => this.previous().measurements.tires);
  protected readonly sources = computed(() => this.previous().sources);

  private readonly previousValves = computed(
    () =>
      new Map(
        (this.previous().measurements.valveClearance?.valves ?? []).map((valve) => [
          valveKey(valve),
          valve.measured,
        ]),
      ),
  );

  protected readonly shimAdjusted = computed(
    () => this.specification()?.valveAdjustment !== ValveAdjustment.Screw,
  );

  /** The backend can only suggest shims if the vehicle has both target ranges and the step. */
  protected readonly canSuggestShims = computed(() => {
    const spec = this.specification();
    return (
      this.shimAdjusted() &&
      spec?.shimStep !== undefined &&
      spec.intakeClearanceMin !== undefined &&
      spec.intakeClearanceMax !== undefined &&
      spec.exhaustClearanceMin !== undefined &&
      spec.exhaustClearanceMax !== undefined
    );
  });

  protected readonly valveLayout = computed(() => {
    const valves = this.drafts().valveClearance;
    return valves?.length ? layoutOf(valves) : null;
  });

  /** Inputs of the shim calculation; only changes of measured value or old shim trigger a new request. */
  private readonly shimInputs = computed<ShimCalculationInput[] | undefined>(
    () => {
      const valves = this.drafts().valveClearance;
      if (
        !valves ||
        !this.canSuggestShims() ||
        !valves.some((valve) => valve.measured !== null && valve.shimOld !== null)
      ) {
        return undefined;
      }
      return valves.map((valve) => ({
        valve: valve.valve,
        measured: valve.measured ?? undefined,
        shimOld: valve.shimOld ?? undefined,
      }));
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  /** Shim suggestions in the order of the valve rows. */
  protected readonly shimResults = rxResource({
    params: () => this.shimInputs(),
    // A new input cancels the running timer, so the request is only sent once typing pauses.
    stream: ({ params }) =>
      timer(SHIM_DEBOUNCE_MS).pipe(
        switchMap(() =>
          this.measurementsService.calculateShims(this.vehicleId(), { valves: params }),
        ),
        map((response) => stripNulls(response.results)),
      ),
  });

  protected shimResult(index: number): ShimCalculationResult | undefined {
    return this.shimResults.hasValue() ? this.shimResults.value()[index] : undefined;
  }

  protected previousValve(valve: ValveDraft): number | undefined {
    return this.previousValves().get(valveKey(valve));
  }

  protected add(template: WorksheetTemplate): void {
    const spec = this.specification();
    this.drafts.update((drafts) => {
      switch (template) {
        case WorksheetTemplate.ValveClearance:
          return {
            ...drafts,
            valveClearance: newValveDrafts(
              spec,
              this.previous().measurements.valveClearance?.valves,
            ),
          };
        case WorksheetTemplate.Brakes:
          return { ...drafts, brakes: emptyBrakes() };
        case WorksheetTemplate.Chain:
          return { ...drafts, chain: emptyChain(spec) };
        case WorksheetTemplate.Tires:
          return { ...drafts, tires: emptyTires() };
      }
    });
  }

  protected remove(key: MeasurementKey): void {
    this.drafts.update((drafts) => ({ ...drafts, [key]: null }));
  }

  protected changeLayout(cylinders: number, valvesPerCylinder: number): void {
    this.drafts.update((drafts) => ({
      ...drafts,
      valveClearance: valveLayout(cylinders, valvesPerCylinder, drafts.valveClearance ?? []),
    }));
  }

  protected changeValve(index: number, changes: Partial<ValveDraft>): void {
    this.drafts.update((drafts) => ({
      ...drafts,
      valveClearance: (drafts.valveClearance ?? []).map((valve, i) =>
        i === index ? { ...valve, ...changes } : valve,
      ),
    }));
  }

  protected takeOver(index: number, shim: number): void {
    this.changeValve(index, { shimNew: shim });
  }

  protected changeBrakes(changes: Partial<BrakeDraft>): void {
    this.drafts.update((drafts) =>
      drafts.brakes ? { ...drafts, brakes: { ...drafts.brakes, ...changes } } : drafts,
    );
  }

  protected changeChain(changes: Partial<ChainDraft>): void {
    this.drafts.update((drafts) =>
      drafts.chain ? { ...drafts, chain: { ...drafts.chain, ...changes } } : drafts,
    );
  }

  protected changeTires(changes: Partial<TireDraft>): void {
    this.drafts.update((drafts) =>
      drafts.tires ? { ...drafts, tires: { ...drafts.tires, ...changes } } : drafts,
    );
  }

  /** Empty number inputs give `null` or `''`; both mean "no value". */
  protected toNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
