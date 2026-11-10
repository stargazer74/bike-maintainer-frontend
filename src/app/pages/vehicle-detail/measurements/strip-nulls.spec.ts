import { stripNulls } from './strip-nulls';

describe('stripNulls', () => {
  it('leaves out null properties at every level and keeps other falsy values', () => {
    expect(
      stripNulls({ a: null, b: 0, c: '', d: false, e: { f: null, g: [{ h: null, i: 1 }] } }),
    ).toEqual({ b: 0, c: '', d: false, e: { g: [{ i: 1 }] } });
    expect(stripNulls(undefined)).toBeUndefined();
  });
});
