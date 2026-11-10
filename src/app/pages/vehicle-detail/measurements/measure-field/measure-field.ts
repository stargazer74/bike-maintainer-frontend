import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocalNumberPipe } from '../../../../i18n/localized-pipes';

/**
 * Number input for one measured value with its unit, the target value of the vehicle and the value of the last
 * measurement as a hint below it.
 */
@Component({
  selector: 'app-measure-field',
  imports: [FormsModule, LocalNumberPipe, TranslocoPipe],
  templateUrl: './measure-field.html',
  styleUrl: './measure-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasureField {
  readonly fieldId = input.required<string>();
  /** Translation key of the label. */
  readonly label = input.required<string>();
  readonly unit = input('mm');
  readonly step = input('0.001');
  readonly value = input<number | null>(null);
  readonly valueChange = output<number | null>();
  /** Target range or limit of the vehicle; any of them may be missing. */
  readonly targetMin = input<number | undefined>(undefined);
  readonly targetMax = input<number | undefined>(undefined);
  /** Single target value, e.g. a tyre pressure. */
  readonly target = input<number | undefined>(undefined);
  /** Value of the last measurement. */
  readonly previous = input<number | undefined>(undefined);
  /** Translation key of the problem with the value. */
  readonly error = input<string | null>(null);
  readonly showError = input(false);

  /** Empty number inputs give `null` or `''`; both mean "no value". */
  protected emit(value: unknown): void {
    this.valueChange.emit(typeof value === 'number' && Number.isFinite(value) ? value : null);
  }
}
