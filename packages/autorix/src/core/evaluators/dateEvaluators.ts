import { ConditionOperator } from "../enums/conditions.enum";
import { ConditionEvaluatorFn } from "../types";

/**
 * Parsea una entrada a un objeto Date.
 * @private
 * @param {any} input - El valor a parsear (puede ser string, número o Date).
 * @returns {Date | null} Un objeto Date si el parseo es exitoso, null en caso contrario.
 */
function parseDate(input: any): Date | null {
  const date = new Date(input);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * @description Registro de funciones evaluadoras para operadores de condición relacionados con fechas.
 */
export const dateEvaluators: Partial<
  Record<ConditionOperator, ConditionEvaluatorFn>
> = {
  /**
   * Comprueba si la fecha `actual` es menor o igual que la fecha `expected`.
   */
  [ConditionOperator.DATE_LESS_THAN_EQUALS]: (expected, actual) => {
    const expectedDate = parseDate(expected);
    const actualDate = parseDate(actual);
    if (!expectedDate || !actualDate) return false;
    return actualDate <= expectedDate;
  },

  /**
   * Comprueba si la fecha `actual` es mayor que la fecha `expected`.
   */
  [ConditionOperator.DATE_GREATER_THAN]: (expected, actual) => {
    const expectedDate = parseDate(expected);
    const actualDate = parseDate(actual);
    if (!expectedDate || !actualDate) return false;
    return actualDate > expectedDate;
  },

  /**
   * Comprueba si la fecha `actual` es igual a la fecha `expected`.
   */
  [ConditionOperator.DATE_EQUALS]: (expected, actual) => {
    const expectedDate = parseDate(expected);
    const actualDate = parseDate(actual);
    if (!expectedDate || !actualDate) return false;
    return actualDate.getTime() === expectedDate.getTime();
  },

  /**
   * Comprueba si la fecha `actual` no es igual a la fecha `expected`.
   */
  [ConditionOperator.DATE_NOT_EQUALS]: (expected, actual) => {
    const expectedDate = parseDate(expected);
    const actualDate = parseDate(actual);
    if (!expectedDate || !actualDate) return false;
    return actualDate.getTime() !== expectedDate.getTime();
  },

  /**
   * Comprueba si la fecha `actual` es menor que la fecha `expected`.
   */
  [ConditionOperator.DATE_LESS_THAN]: (expected, actual) => {
    const expectedDate = parseDate(expected);
    const actualDate = parseDate(actual);
    if (!expectedDate || !actualDate) return false;
    return actualDate < expectedDate;
  },

  /**
   * Comprueba si la fecha `actual` es mayor o igual que la fecha `expected`.
   */
  [ConditionOperator.DATE_GREATER_THAN_EQUALS]: (expected, actual) => {
    const expectedDate = parseDate(expected);
    const actualDate = parseDate(actual);
    if (!expectedDate || !actualDate) return false;
    return actualDate >= expectedDate;
  },

  /**
   * Comprueba si la fecha `actual` está dentro del rango de fechas `expected` (inclusive).
   * @param {[any, any]} expected - Un array con dos elementos: [fechaInicio, fechaFin].
   */
  [ConditionOperator.DATE_IN_RANGE]: (expected, actual) => {
    const actualDate = parseDate(actual);
    if (!Array.isArray(expected) || expected.length !== 2 || !actualDate)
      return false;
    const [start, end] = expected.map(parseDate);
    if (!start || !end) return false;
    return actualDate >= start && actualDate <= end;
  },
};
