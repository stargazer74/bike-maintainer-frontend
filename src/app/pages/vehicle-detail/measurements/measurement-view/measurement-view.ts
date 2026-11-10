import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  MaintenanceMeasurementsResponse,
  MeasurementStatus,
  ValveKind,
  ValveMeasurementResponse,
} from '../../../../api-client';
import { LocalNumberPipe } from '../../../../i18n/localized-pipes';
import { layoutOf } from '../measurement-draft';
import { stripNulls } from '../strip-nulls';

/** One shown value; `status` comes from the backend's check against the vehicle's target values. */
export interface MeasurementRow {
  readonly label: string;
  readonly value: number | string;
  readonly unit?: string;
  readonly digits?: string;
  readonly status?: MeasurementStatus;
}

interface ValveRow {
  readonly valve: ValveMeasurementResponse;
  readonly labelKey: string;
  readonly index: string;
}

/** Rows for the values that were measured; empty fields are left out. */
function rows(
  entries: readonly (readonly [string, number | string | undefined, Partial<MeasurementRow>?])[],
): MeasurementRow[] {
  return entries
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([label, value, extra]) => ({ label, value: value as number | string, ...extra }));
}

/** Number of measured values outside the vehicle's target values. */
export function outOfRangeCount(measurements: MaintenanceMeasurementsResponse | undefined): number {
  if (!measurements) {
    return 0;
  }
  const { valveClearance, brakes, chain, tires } = measurements;
  const statuses = [
    ...(valveClearance?.valves ?? []).map((valve) => valve.measuredStatus),
    brakes?.padFrontStatus,
    brakes?.padRearStatus,
    brakes?.discFrontStatus,
    brakes?.discRearStatus,
    chain?.slackStatus,
    chain?.wearLengthStatus,
    tires?.pressureFrontStatus,
    tires?.pressureRearStatus,
    tires?.treadFrontStatus,
    tires?.treadRearStatus,
  ];
  return statuses.filter((status) => status === MeasurementStatus.OutOfRange).length;
}

/** Read-only view of the measured values of a maintenance log, with values outside the target marked. */
@Component({
  selector: 'app-measurement-view',
  imports: [LocalNumberPipe, NgTemplateOutlet, TranslocoPipe],
  templateUrl: './measurement-view.html',
  styleUrl: './measurement-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasurementView {
  readonly measurements = input.required({
    transform: (value: MaintenanceMeasurementsResponse) => stripNulls(value),
  });

  protected readonly outOfRange = MeasurementStatus.OutOfRange;
  protected readonly ok = MeasurementStatus.Ok;

  protected readonly valves = computed<ValveRow[]>(() => {
    const valves = this.measurements().valveClearance?.valves ?? [];
    if (!valves.length) {
      return [];
    }
    const { valvesPerCylinder } = layoutOf(valves);
    // Valves without any value were part of the layout but not measured.
    const measured = valves.filter(
      (valve) =>
        valve.measured !== undefined || valve.shimOld !== undefined || valve.shimNew !== undefined,
    );
    return measured.map((valve) => {
      const intake = valve.valve === ValveKind.Intake;
      const showIndex = intake ? valvesPerCylinder >= 3 : valvesPerCylinder === 4;
      return {
        valve,
        labelKey: intake ? 'measurements.valve.intake' : 'measurements.valve.exhaust',
        index: showIndex ? ' ' + valve.index : '',
      };
    });
  });

  protected readonly brakes = computed(() => {
    const brakes = this.measurements().brakes;
    return brakes
      ? rows([
          [
            'measurements.brakes.padFront',
            brakes.padFront,
            { unit: 'mm', status: brakes.padFrontStatus },
          ],
          [
            'measurements.brakes.padRear',
            brakes.padRear,
            { unit: 'mm', status: brakes.padRearStatus },
          ],
          [
            'measurements.brakes.discFront',
            brakes.discFront,
            { unit: 'mm', status: brakes.discFrontStatus },
          ],
          [
            'measurements.brakes.discRear',
            brakes.discRear,
            { unit: 'mm', status: brakes.discRearStatus },
          ],
          ['measurements.brakes.discConditionFront', brakes.discConditionFront],
          ['measurements.brakes.discConditionRear', brakes.discConditionRear],
          ['measurements.brakes.fluidCondition', brakes.fluidCondition],
        ])
      : null;
  });

  protected readonly chain = computed(() => {
    const chain = this.measurements().chain;
    return chain
      ? {
          rows: rows([
            ['measurements.chain.slack', chain.slack, { unit: 'mm', status: chain.slackStatus }],
            [
              'measurements.chain.wearLength',
              chain.wearLength,
              { unit: 'mm', status: chain.wearLengthStatus },
            ],
            ['measurements.chain.wearLinks', chain.wearLinks, { digits: '1.0-0' }],
            ['measurements.chain.sprocketCondition', chain.sprocketCondition],
            ['measurements.chain.rearSprocketCondition', chain.rearSprocketCondition],
          ]),
          cleaned: chain.cleaned === true,
          lubricated: chain.lubricated === true,
        }
      : null;
  });

  protected readonly tires = computed(() => {
    const tires = this.measurements().tires;
    return tires
      ? rows([
          [
            'measurements.tires.pressureFront',
            tires.pressureFront,
            { unit: 'bar', digits: '1.1-2', status: tires.pressureFrontStatus },
          ],
          [
            'measurements.tires.pressureRear',
            tires.pressureRear,
            { unit: 'bar', digits: '1.1-2', status: tires.pressureRearStatus },
          ],
          [
            'measurements.tires.treadFront',
            tires.treadFront,
            { unit: 'mm', status: tires.treadFrontStatus },
          ],
          [
            'measurements.tires.treadRear',
            tires.treadRear,
            { unit: 'mm', status: tires.treadRearStatus },
          ],
          ['measurements.tires.dotFront', tires.dotFront],
          ['measurements.tires.dotRear', tires.dotRear],
          ['measurements.tires.conditionFront', tires.conditionFront],
          ['measurements.tires.conditionRear', tires.conditionRear],
        ])
      : null;
  });

  protected isNumber(value: number | string): value is number {
    return typeof value === 'number';
  }
}
