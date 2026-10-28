/** Only paths within this app are followed; `//host` or absolute URLs could lead to another site. */
export function isSafeReturnUrl(url: string | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}
