import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-maintenance-tasks',
  imports: [MatCardModule, MatIconModule],
  templateUrl: './maintenance-tasks.html',
  styleUrl: './maintenance-tasks.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaintenanceTasks {}
