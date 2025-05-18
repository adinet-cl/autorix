import { ConditionOperator } from "../enums/conditions.enum";
import { ConditionEvaluatorFn } from "../types";

/**
 * @description Registro de funciones evaluadoras para operadores de condición numéricos.
 */
export const numericEvaluators: Partial<
  Record<ConditionOperator, ConditionEvaluatorFn>
> = {
  /**
   * Comprueba si el número `actual` es menor o igual que el número `expected`.
   */
  [ConditionOperator.NUMERIC_LESS_THAN_EQUALS]: (expected, actual) => {
    const numExpected = Number(expected);
    const numActual = Number(actual);
    if (isNaN(numExpected) || isNaN(numActual)) return false;
    return numActual <= numExpected;
  },
  /**
   * Comprueba si el número `actual` es igual al número `expected`.
   */
  [ConditionOperator.NUMERIC_EQUALS]: (expected, actual) => {
    const numExpected = Number(expected);
    const numActual = Number(actual);
    if (isNaN(numExpected) || isNaN(numActual)) return false;
    return numActual === numExpected;
  },
  /**
   * Comprueba si el número `actual` no es igual al número `expected`.
   */
  [ConditionOperator.NUMERIC_NOT_EQUALS]: (expected, actual) => {
    const numExpected = Number(expected);
    const numActual = Number(actual);
    if (isNaN(numExpected) || isNaN(numActual)) return false;
    return numActual !== numExpected;
  },
  /**
   * Comprueba si el número `actual` es menor que el número `expected`.
   */
  [ConditionOperator.NUMERIC_LESS_THAN]: (expected, actual) => {
    const numExpected = Number(expected);
    const numActual = Number(actual);
    if (isNaN(numExpected) || isNaN(numActual)) return false;
    return numActual < numExpected;
  },
  /**
   * Comprueba si el número `actual` es mayor que el número `expected`.
   */
  [ConditionOperator.NUMERIC_GREATER_THAN]: (expected, actual) => {
    const numExpected = Number(expected);
    const numActual = Number(actual);
    if (isNaN(numExpected) || isNaN(numActual)) return false;
    return numActual > numExpected;
  },
  /**
   * Comprueba si el número `actual` es mayor o igual que el número `expected`.
   */
  [ConditionOperator.NUMERIC_GREATER_THAN_EQUALS]: (expected, actual) => {
    const numExpected = Number(expected);
    const numActual = Number(actual);
    if (isNaN(numExpected) || isNaN(numActual)) return false;
    return numActual >= numExpected;
  },
};
