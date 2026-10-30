import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { MaterialUnit } from '../../../api-client';
import { LocalCurrencyPipe } from '../../../i18n/localized-pipes';
import {
  draftTotalCents,
  emptyMaterial,
  MaterialDraft,
  materialDraftError,
} from './material-draft';

/** Most material rows the backend accepts with one maintenance log (`maxItems` of `materials`). */
export const MAX_MATERIALS = 50;

/** Lets the user list the material used for a maintenance log, optionally assigned to a checked task. */
@Component({
  selector: 'app-material-editor',
  imports: [FormsModule, MatButtonModule, MatIconModule, TranslocoPipe, LocalCurrencyPipe],
  templateUrl: './material-editor.html',
  styleUrl: './material-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaterialEditor {
  readonly drafts = model.required<readonly MaterialDraft[]>();
  /** Tasks a row can be assigned to: only the ones checked in the log form. */
  readonly tasks = input<readonly { id: number; name: string }[]>([]);
  /** Currency code the prices are entered and summed in. */
  readonly currency = input('EUR');
  /** Shows the problems of incomplete rows, e.g. after a save attempt. */
  readonly showErrors = input(false);
  /** Shows the sum of the material prices below the rows; turn off if the parent shows an overall sum. */
  readonly showTotal = input(true);

  protected readonly maxMaterials = MAX_MATERIALS;
  protected readonly units = Object.values(MaterialUnit);
  protected readonly materialError = materialDraftError;

  protected readonly totalCents = computed(() => draftTotalCents(this.drafts(), null));
  protected readonly total = computed(() => {
    const cents = this.totalCents();
    return cents === null ? null : cents / 100;
  });

  protected add(): void {
    this.drafts.update((drafts) => [...drafts, emptyMaterial()]);
  }

  protected remove(key: number): void {
    this.drafts.update((drafts) => drafts.filter((draft) => draft.key !== key));
  }

  protected change(key: number, changes: Partial<Omit<MaterialDraft, 'key'>>): void {
    this.drafts.update((drafts) =>
      drafts.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)),
    );
  }

  /** A task that is no longer checked shows as "no task" (the form clears it in its state). */
  protected selectedTask(draft: MaterialDraft): number | null {
    return this.tasks().some((task) => task.id === draft.taskId) ? draft.taskId : null;
  }

  /** Empty number inputs give `null` or `''`; both mean "no value". */
  protected toNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
}
