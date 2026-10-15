import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

type TranslationTree = { [key: string]: string | TranslationTree };

function flatten(tree: TranslationTree, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.set(path, value);
    } else {
      flatten(value, path).forEach((v, k) => result.set(k, v));
    }
  }
  return result;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort();
}

describe('translation files', () => {
  const german = flatten(de);
  const english = flatten(en);

  it('define the same keys in German and English', () => {
    expect([...english.keys()].sort()).toEqual([...german.keys()].sort());
  });

  it('have no empty texts', () => {
    const empty = [...german, ...english].filter(([, text]) => !text.trim()).map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('use the same placeholders in both languages', () => {
    const mismatches = [...german.keys()].filter(
      (key) => placeholders(german.get(key)!).join() !== placeholders(english.get(key) ?? '').join(),
    );
    expect(mismatches).toEqual([]);
  });
});
