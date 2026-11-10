/**
 * The backend sends empty values as `null`, while the generated types (and the components here) expect them to be
 * left out. Removes `null` properties from an API object, recursively.
 */
export function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown) => stripNulls(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, property]) => property !== null)
        .map(([key, property]) => [key, stripNulls(property)]),
    ) as T;
  }
  return value;
}
