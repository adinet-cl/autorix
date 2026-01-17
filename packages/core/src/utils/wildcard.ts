/**
 * Simple wildcard matcher supporting '*'.
 * - '*' matches any sequence (including empty)
 * - no '?' or '**' in MVP
 */
export function wildcardMatch(pattern: string, input: string): boolean {
  if (pattern === '*') return true;
  // Escape regex special chars except '*'
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
  const re = new RegExp(regexStr);
  return re.test(input);
}

export function matchOneOrMany(value: string, patterns: string | string[]): boolean {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  return list.some((p) => wildcardMatch(p, value));
}
