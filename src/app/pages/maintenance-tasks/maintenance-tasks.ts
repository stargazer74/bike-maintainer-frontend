import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-maintenance-tasks',
  imports: [MatCardModule, MatIconModule, TranslocoPipe],
  templateUrl: './maintenance-tasks.html',
  styleUrl: './maintenance-tasks.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceTasks {}
