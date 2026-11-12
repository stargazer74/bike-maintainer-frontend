import { isLoopback, qrCode } from './qr-code';

/** The dark modules of a path from {@link qrCode}, as `"col,row"`. */
function darkModules(path: string): Set<string> {
  return new Set(Array.from(path.matchAll(/M(\d+) (\d+)h1v1h-1z/g), (m) => `${m[1]},${m[2]}`));
}

describe('qrCode', () => {
  it('uses the smallest version that fits: 4 · version + 17 modules', () => {
    expect(qrCode('http://192.168.1.20:8080').size).toBe(25); // version 2
    expect(qrCode('https://bike-maintainer.home.example.org:8443').size).toBe(33); // version 4
  });

  it('draws the three finder patterns', () => {
    const { size, path } = qrCode('http://192.168.1.20:8080');
    const dark = darkModules(path);
    // Outer ring and centre of each finder pattern are dark, the ring between them light.
    for (const [col, row] of [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ]) {
      expect(dark.has(`${col},${row}`)).toBe(true);
      expect(dark.has(`${col + 3},${row + 3}`)).toBe(true);
      expect(dark.has(`${col + 1},${row + 1}`)).toBe(false);
    }
  });

  it('is deterministic and depends on the text', () => {
    expect(qrCode('http://192.168.1.20').path).toBe(qrCode('http://192.168.1.20').path);
    expect(qrCode('http://192.168.1.20').path).not.toBe(qrCode('http://192.168.1.21').path);
  });
});

describe('isLoopback', () => {
  for (const origin of [
    'http://localhost:4200',
    'http://LOCALHOST',
    'http://app.localhost:8080',
    'http://127.0.0.1:8080',
    'http://127.1.2.3',
    'http://[::1]:8080',
  ]) {
    it(`is true for ${origin}`, () => expect(isLoopback(origin)).toBe(true));
  }

  for (const origin of [
    'http://192.168.1.20:8080',
    'http://bike.fritz.box',
    'https://localhost.example.org',
    'http://10.127.0.1',
    'not a url',
  ]) {
    it(`is false for ${origin}`, () => expect(isLoopback(origin)).toBe(false));
  }
});
