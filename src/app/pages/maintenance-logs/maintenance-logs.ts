import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-maintenance-logs',
  imports: [MatCardModule, MatIconModule, TranslocoPipe],
  templateUrl: './maintenance-logs.html',
  styleUrl: './maintenance-logs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceLogs {}
