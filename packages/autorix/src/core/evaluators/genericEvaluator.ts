import { ConditionOperator } from "../enums/conditions.enum";
import { ConditionEvaluatorFn } from "../types";

/**
 * @description Registro de funciones evaluadoras para operadores de condición genéricos.
 */
export const genericEvaluators: Partial<
  Record<ConditionOperator, ConditionEvaluatorFn>
> = {
  /**
   * Comprueba si el valor `actual` es nulo o indefinido.
   * @param {boolean} expected - Si es `true`, se espera que `actual` sea nulo/indefinido. Si es `false`, se espera que no lo sea.
   * @param {any} actual - El valor actual del contexto.
   * @returns {boolean} `true` si la condición de nulidad se cumple.
   */
  [ConditionOperator.IS_NULL]: (expected, actual) => {
    return Boolean(expected) === (actual === null || actual === undefined);
  },
};
