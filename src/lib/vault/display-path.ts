/** Collapses the user's home prefix to `~`. */
export function displayPath(absolute: string): string {
  return absolute.replace(/^\/(?:Users|home)\/[^/]+/, '~');
}
