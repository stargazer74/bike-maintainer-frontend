import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom, of } from 'rxjs';
import { translocoTesting } from '../../i18n/testing';
import { confirmAction, ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

const DATA: ConfirmDialogData = {
  title: 'profiles.deleteTitle',
  message: 'profiles.confirmDelete',
  params: { name: 'Anna' },
  confirm: 'common.delete',
};

describe('ConfirmDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
  });

  async function openDialog() {
    const ref = TestBed.inject(MatDialog).open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data: DATA,
    });
    TestBed.inject(MatDialog).openDialogs[0].componentRef!.changeDetectorRef.detectChanges();
    const element = document.querySelector<HTMLElement>('app-confirm-dialog')!;
    return { ref, element };
  }

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it('shows the translated title, message and confirm label', async () => {
    const { element } = await openDialog();

    expect(element.querySelector('h2')?.textContent).toContain('Person löschen?');
    expect(element.textContent).toContain('Soll „Anna“ wirklich gelöscht werden?');
    expect(element.querySelector('.confirm-dialog__confirm')?.textContent?.trim()).toBe('Löschen');
  });

  it('closes with true when confirmed', async () => {
    const { ref, element } = await openDialog();
    const result = firstValueFrom(ref.afterClosed());

    element.querySelector<HTMLButtonElement>('.confirm-dialog__confirm')!.click();

    expect(await result).toBe(true);
  });

  it('closes with false when cancelled', async () => {
    const { ref, element } = await openDialog();
    const result = firstValueFrom(ref.afterClosed());

    element.querySelector<HTMLButtonElement>('.confirm-dialog__cancel')!.click();

    expect(await result).toBe(false);
  });

  describe('confirmAction()', () => {
    function answer(result: boolean | undefined) {
      const dialog = TestBed.inject(MatDialog);
      const open = vi
        .spyOn(dialog, 'open')
        .mockReturnValue({ afterClosed: () => of(result) } as ReturnType<MatDialog['open']>);
      return { dialog, open };
    }

    afterEach(() => vi.restoreAllMocks());

    it('opens the dialog with the given texts', async () => {
      const { dialog, open } = answer(true);

      await firstValueFrom(confirmAction(dialog, DATA));

      expect(open).toHaveBeenCalledWith(ConfirmDialog, { data: DATA });
    });

    it('emits true when confirmed', async () => {
      const { dialog } = answer(true);

      expect(await firstValueFrom(confirmAction(dialog, DATA))).toBe(true);
    });

    it('emits false when cancelled or dismissed', async () => {
      expect(await firstValueFrom(confirmAction(answer(false).dialog, DATA))).toBe(false);
      vi.restoreAllMocks();
      expect(await firstValueFrom(confirmAction(answer(undefined).dialog, DATA))).toBe(false);
    });
  });
});
