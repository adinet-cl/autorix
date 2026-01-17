import { matchOneOrMany } from '../utils/wildcard';

export function matchAction(action: string, statementAction: string | string[]): boolean {
  return matchOneOrMany(action, statementAction);
}
