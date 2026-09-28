import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-maintenance-logs',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './maintenance-logs.html',
  styleUrl: './maintenance-logs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceLogs {}
