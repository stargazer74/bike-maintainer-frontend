import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { draftError, emptyDraft, NewTaskDraft } from './new-task-draft';

/** Most new tasks the backend accepts with one maintenance log (`maxItems` of `newTasks`). */
export const MAX_NEW_TASKS = 20;

/**
 * Lets the user add work that is no maintenance task yet while recording maintenance. Each entry becomes a task
 * when the log is saved: one-time by default, recurring with an interval if chosen.
 */
@Component({
  selector: 'app-new-task-editor',
  imports: [FormsModule, MatButtonModule, MatIconModule, TranslocoPipe],
  templateUrl: './new-task-editor.html',
  styleUrl: './new-task-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewTaskEditor {
  readonly drafts = model.required<readonly NewTaskDraft[]>();
  /** Shows the problems of incomplete entries, e.g. after a save attempt. */
  readonly showErrors = input(false);

  protected readonly maxNewTasks = MAX_NEW_TASKS;
  protected readonly draftError = draftError;

  protected add(): void {
    this.drafts.update((drafts) => [...drafts, emptyDraft()]);
  }

  protected remove(key: number): void {
    this.drafts.update((drafts) => drafts.filter((draft) => draft.key !== key));
  }

  protected change(key: number, changes: Partial<Omit<NewTaskDraft, 'key'>>): void {
    this.drafts.update((drafts) =>
      drafts.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)),
    );
  }

  /** Empty number inputs give `null` or `''`; both mean "no interval". */
  protected toNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
