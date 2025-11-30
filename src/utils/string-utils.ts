/**
 * Author: Chris M. Pérez
 * License: MIT
 */

/**
 * Converts PascalCase to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

/**
 * Converts string to Title Case
 */
export function toTitleCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Simple pluralization
 */
export function pluralize(str: string): string {
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('z')) {
    return str + 'es';
  }
  if (str.endsWith('y')) {
    return str.slice(0, -1) + 'ies';
  }
  return str + 's';
}
