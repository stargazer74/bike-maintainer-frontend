import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { CostSummaryEntry } from '../../../api-client';
import { LocalCurrencyPipe } from '../../../i18n/localized-pipes';

/** Shows the maintenance costs of a vehicle as totals per currency (all time and current year). */
@Component({
  selector: 'app-cost-tile',
  imports: [LocalCurrencyPipe, MatIconModule, TranslocoPipe],
  templateUrl: './cost-tile.html',
  styleUrl: './cost-tile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostTile {
  readonly entries = input.required<readonly CostSummaryEntry[]>();
}
