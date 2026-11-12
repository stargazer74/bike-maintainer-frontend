import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { isLoopback, qrCode } from './qr-code';

export interface AppConnectDialogData {
  /** Address of this server as the browser sees it (`location.origin`). */
  readonly address: string;
}

/** Quiet zone around the code in modules; the QR standard asks for 4. */
const QUIET_ZONE = 4;

/**
 * Household mode (frontend#109): shows the address of this server as QR code, for "Own server → Scan QR code" in
 * the Android app. The code is an ordinary URL, so a phone camera opens the web app with it as well. It is
 * generated in the browser; nothing leaves the device.
 */
@Component({
  selector: 'app-app-connect-dialog',
  imports: [MatDialogModule, MatIconModule, TranslocoPipe],
  templateUrl: './app-connect-dialog.html',
  styleUrl: './app-connect-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppConnectDialog {
  protected readonly address = inject<AppConnectDialogData>(MAT_DIALOG_DATA).address;
  protected readonly qr = qrCode(this.address);
  protected readonly quietZone = QUIET_ZONE;
  /** Width and height of the code including its quiet zone, in modules. */
  protected readonly frame = this.qr.size + 2 * QUIET_ZONE;
  protected readonly viewBox = `${-QUIET_ZONE} ${-QUIET_ZONE} ${this.frame} ${this.frame}`;
  /** A phone cannot reach `localhost`: the page has to be opened via its address in the home network. */
  protected readonly loopback = isLoopback(this.address);
}
