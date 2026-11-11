import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { map, Observable } from 'rxjs';

/** Texts of the dialog as translation keys; `params` fill the placeholders of title and message. */
export interface ConfirmDialogData {
  readonly title: string;
  readonly message: string;
  readonly params?: Record<string, unknown>;
  /** Label of the confirm button, e.g. `common.delete`. */
  readonly confirm: string;
}

/**
 * Explains why something cannot be done (frontend#96), e.g. deleting what is still in use. Only "Got it", plus an
 * optional way out (`action`, e.g. `taskForm.deactivate`). Texts are translation keys like in {@link ConfirmDialogData}.
 */
export interface InfoDialogData {
  readonly title: string;
  readonly message: string;
  /** A second paragraph, e.g. what to do instead. */
  readonly hint?: string;
  readonly params?: Record<string, unknown>;
  /** Label of the button for the way out; closes the dialog with `true`. */
  readonly action?: string;
}

type DialogData =
  | (ConfirmDialogData & { readonly variant?: 'confirm' })
  | (InfoDialogData & { readonly variant: 'info' });

/**
 * Asks before a destructive action, in the app's design instead of the browser's `confirm()`. Closes with
 * `true` when confirmed and `false` when cancelled (`undefined` if dismissed via Escape or backdrop). The info
 * variant ({@link showInfo}) only explains and closes with `true` if its action was chosen.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatIconModule, TranslocoPipe],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialog, boolean>);

  protected close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}

/** Opens the {@link ConfirmDialog}; emits `true` only if the user confirmed. */
export function confirmAction(dialog: MatDialog, data: ConfirmDialogData): Observable<boolean> {
  return dialog
    .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
    .afterClosed()
    .pipe(map((confirmed) => confirmed === true));
}

/** Opens the {@link ConfirmDialog} as an info; emits `true` only if the user chose its action. */
export function showInfo(dialog: MatDialog, data: InfoDialogData): Observable<boolean> {
  return dialog
    .open<ConfirmDialog, DialogData, boolean>(ConfirmDialog, { data: { ...data, variant: 'info' } })
    .afterClosed()
    .pipe(map((chosen) => chosen === true));
}
