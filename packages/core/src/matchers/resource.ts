import { matchOneOrMany } from '../utils/wildcard';

export function matchResource(resource: string, statementResource: string | string[]): boolean {
  return matchOneOrMany(resource, statementResource);
}
