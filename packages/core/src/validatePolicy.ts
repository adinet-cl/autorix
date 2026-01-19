import type { PolicyDocument, Statement, ConditionBlock, ConditionOperator } from './types';
import { AutorixPolicyValidationError } from './errors';

const OPERATORS: ConditionOperator[] = ['StringEquals', 'StringLike', 'NumericEquals', 'Bool'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string' && x.length > 0);
}

function isStringOrStringArray(v: unknown): v is string | string[] {
  return typeof v === 'string' || isStringArray(v);
}

function validateConditionBlock(cond: unknown, errors: string[], path: string) {
  if (cond === undefined) return;

  if (!isPlainObject(cond)) {
    errors.push(`${path} must be an object`);
    return;
  }

  for (const key of Object.keys(cond)) {
    if (!OPERATORS.includes(key as ConditionOperator)) {
      errors.push(`${path} has invalid operator "${key}"`);
      continue;
    }

    const opVal = (cond as any)[key];
    if (opVal === undefined) continue;

    if (!isPlainObject(opVal)) {
      errors.push(`${path}.${key} must be an object (key-value map)`);
      continue;
    }

    for (const k of Object.keys(opVal)) {
      if (typeof k !== 'string' || k.length === 0) {
        errors.push(`${path}.${key} has an invalid condition key`);
      }
    }
  }
}

function validateStatement(stmt: unknown, errors: string[], index: number) {
  const p = `Statement[${index}]`;

  if (!isPlainObject(stmt)) {
    errors.push(`${p} must be an object`);
    return;
  }

  const s = stmt as Partial<Statement>;

  if (s.Effect !== 'Allow' && s.Effect !== 'Deny') {
    errors.push(`${p}.Effect must be "Allow" or "Deny"`);
  }

  if (!isStringOrStringArray(s.Action)) {
    errors.push(`${p}.Action must be a non-empty string or string[]`);
  }

  if (!isStringOrStringArray(s.Resource)) {
    errors.push(`${p}.Resource must be a non-empty string or string[]`);
  }

  validateConditionBlock(s.Condition, errors, `${p}.Condition`);
}

/**
 * Validates a policy document structure.
 * 
 * Checks that the policy document follows the correct schema:
 * - Has a Statement array
 * - Each statement has valid Effect, Action, Resource
 * - Conditions use supported operators (StringEquals, StringLike, NumericEquals, Bool)
 * 
 * @param policy - The policy document to validate
 * @returns Object with `valid` boolean and `errors` array of error messages
 * 
 * @example
 * ```typescript
 * import { validatePolicyDocument } from '@autorix/core';
 * 
 * const result = validatePolicyDocument({
 *   Statement: [
 *     {
 *       Effect: 'Allow',
 *       Action: 'post:*',
 *       Resource: 'post/*'
 *     }
 *   ]
 * });
 * 
 * if (!result.valid) {
 *   console.error('Invalid policy:', result.errors);
 * }
 * ```
 */
export function validatePolicyDocument(policy: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isPlainObject(policy)) {
    return { valid: false, errors: ['Policy must be an object'] };
  }

  const stmt = (policy as Record<string, unknown>)['Statement'];

  if (!Array.isArray(stmt)) {
    errors.push('Policy.Statement must be an array');
  } else {
    stmt.forEach((s, i) => validateStatement(s, errors, i));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a policy document and throws an error if invalid.
 * 
 * This is a convenience function that calls validatePolicyDocument() and throws
 * AutorixPolicyValidationError if validation fails.
 * 
 * @param policy - The policy document to validate
 * @throws {AutorixPolicyValidationError} If the policy is invalid
 * 
 * @example
 * ```typescript
 * import { assertValidPolicyDocument } from '@autorix/core';
 * 
 * try {
 *   assertValidPolicyDocument(policyDoc);
 *   // Policy is valid, continue
 * } catch (error) {
 *   if (error instanceof AutorixPolicyValidationError) {
 *     console.error('Validation errors:', error.errors);
 *   }
 * }
 * ```
 */
export function assertValidPolicyDocument(policy: unknown): asserts policy is PolicyDocument {
  const res = validatePolicyDocument(policy);
  if (!res.valid) {
    throw new AutorixPolicyValidationError('Invalid policy document', res.errors);
  }
}
