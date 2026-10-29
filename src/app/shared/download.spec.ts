import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { fileNameFromContentDisposition, saveFile } from './download';

describe('fileNameFromContentDisposition', () => {
  it('reads a quoted file name', () => {
    expect(
      fileNameFromContentDisposition('attachment; filename="checkliste-tourer-2026-10-29.pdf"'),
    ).toBe('checkliste-tourer-2026-10-29.pdf');
  });

  it('prefers the encoded file name', () => {
    expect(
      fileNameFromContentDisposition(
        'attachment; filename="fallback.pdf"; filename*=UTF-8\'\'checkliste-%C3%B6l.pdf',
      ),
    ).toBe('checkliste-öl.pdf');
  });

  it('reads an unquoted file name', () => {
    expect(fileNameFromContentDisposition('attachment; filename=report.pdf')).toBe('report.pdf');
  });

  it('returns null without a file name', () => {
    expect(fileNameFromContentDisposition(null)).toBeNull();
    expect(fileNameFromContentDisposition('attachment')).toBeNull();
  });
});

describe('saveFile', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads the body under the name from the response', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:checklist');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const anchors: HTMLAnchorElement[] = [];
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreate(tag);
      if (element instanceof HTMLAnchorElement) {
        anchors.push(element);
      }
      return element;
    });
    const body = new Blob(['%PDF-'], { type: 'application/pdf' });

    saveFile(
      new HttpResponse({
        body,
        headers: new HttpHeaders({
          'Content-Disposition': 'attachment; filename="checkliste.pdf"',
        }),
      }),
      'fallback.pdf',
      document,
    );

    expect(createObjectURL).toHaveBeenCalledWith(body);
    expect(anchors[0].download).toBe('checkliste.pdf');
    expect(anchors[0].href).toBe('blob:checklist');
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:checklist');
    expect(document.body.contains(anchors[0])).toBe(false);
  });

  it('uses the fallback name without Content-Disposition', () => {
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue('blob:x'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const anchors: HTMLAnchorElement[] = [];
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = originalCreate(tag);
      if (element instanceof HTMLAnchorElement) {
        anchors.push(element);
      }
      return element;
    });

    saveFile(new HttpResponse({ body: new Blob(['x']) }), 'fallback.pdf', document);

    expect(anchors[0].download).toBe('fallback.pdf');
  });
});
