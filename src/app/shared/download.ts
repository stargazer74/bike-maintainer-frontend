import { HttpResponse } from '@angular/common/http';

/**
 * How long the object URL stays valid after the click. Safari (especially iOS) starts the download
 * asynchronously and fails with an empty file if the URL is revoked right away.
 */
const REVOKE_DELAY_MS = 30_000;

/** File name from a `Content-Disposition` header; the RFC 5987 form (`filename*=UTF-8''…`) wins. */
export function fileNameFromContentDisposition(header: string | null): string | null {
  if (!header) {
    return null;
  }
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // Malformed encoding: fall back to the plain file name.
    }
  }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(header);
  return plain ? (plain[2] ?? plain[1]).trim() : null;
}

/**
 * Saves a downloaded file (e.g. a PDF from the backend) in the browser under the name the server gave it,
 * or `fallbackName` if it gave none.
 */
export function saveFile(
  response: HttpResponse<Blob>,
  fallbackName: string,
  document: Document,
): void {
  if (!response.body) {
    return;
  }
  const url = URL.createObjectURL(response.body);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    fileNameFromContentDisposition(response.headers.get('Content-Disposition')) ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
