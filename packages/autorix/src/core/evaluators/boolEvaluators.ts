import { ConditionOperator } from "../enums/conditions.enum";
import { ConditionEvaluatorFn } from "../types";

/**
 * @description Registro de funciones evaluadoras para operadores de condición booleanos.
 */
export const boolEvaluators: Partial<
  Record<ConditionOperator, ConditionEvaluatorFn>
> = {
  /**
   * Comprueba si el valor booleano de `actual` es igual al valor booleano de `expected`.
   * @param {any} expected - El valor esperado (se convertirá a booleano).
   * @param {any} actual - El valor actual del contexto (se convertirá a booleano).
   * @returns {boolean} `true` si los equivalentes booleanos son iguales.
   */
  [ConditionOperator.BOOL]: (expected, actual) => {
    return Boolean(actual) === Boolean(expected);
  },
};
