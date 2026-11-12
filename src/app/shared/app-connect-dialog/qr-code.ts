import qrcode from 'qrcode-generator';

/** A QR code as one SVG path: a dark module per `1×1` square, coordinates in modules (no quiet zone). */
export interface QrCode {
  /** Width and height in modules. */
  readonly size: number;
  /** `d` attribute of the path that draws all dark modules. */
  readonly path: string;
}

/**
 * Encodes `text` as QR code, entirely in the browser (no service, no network). Smallest version that fits,
 * error correction level M – plenty for a code shown on a screen.
 */
export function qrCode(text: string): QrCode {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.isDark(row, col)) {
        path += `M${col} ${row}h1v1h-1z`;
      }
    }
  }
  return { size, path };
}

const LOOPBACK_HOSTS = new Set(['localhost', '[::1]']);

/**
 * Whether `origin` points at the browser's own machine – an address a phone cannot reach. Covers `localhost`
 * (and `*.localhost`), the IPv4 loopback range `127.0.0.0/8` and `[::1]`.
 */
export function isLoopback(origin: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost') || /^127\./.test(hostname);
}
