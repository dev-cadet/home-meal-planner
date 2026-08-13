/**
 * A stable hue derived from a name, so a placeholder tile's colour never
 * changes between renders — used for both meal and plan cover placeholders.
 */
export function hueOf(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}
