import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { translocoTesting } from '../../i18n/testing';
import { AppConnectDialog, AppConnectDialogData } from './app-connect-dialog';
import { qrCode } from './qr-code';

function render(address: string): HTMLElement {
  TestBed.configureTestingModule({
    imports: [translocoTesting()],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: { address } as AppConnectDialogData }],
  });
  const fixture = TestBed.createComponent(AppConnectDialog);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('AppConnectDialog', () => {
  it('shows the address as QR code and as text', () => {
    const element = render('http://192.168.1.20:8080');
    const { size, path } = qrCode('http://192.168.1.20:8080');

    const svg = element.querySelector('svg.app-connect__qr')!;
    expect(svg.getAttribute('viewBox')).toBe(`-4 -4 ${size + 8} ${size + 8}`);
    expect(svg.getAttribute('aria-label')).toBe('QR-Code mit der Adresse http://192.168.1.20:8080');
    expect(element.querySelector('.app-connect__qr-modules')!.getAttribute('d')).toBe(path);
    expect(element.querySelector('.app-connect__address')!.textContent).toContain(
      'http://192.168.1.20:8080',
    );
    expect(element.textContent).toContain('Eigener Server → QR-Code scannen');
    expect(element.querySelector('.app-connect__loopback')).toBeNull();
  });

  it('warns that a phone cannot reach localhost', () => {
    const element = render('http://localhost:8080');

    expect(element.querySelector('.app-connect__loopback')!.textContent).toContain(
      'Öffne die Seite über die Adresse im Heimnetz',
    );
  });
});
