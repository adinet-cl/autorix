import { ConditionOperator } from "../enums/conditions.enum";
import { ConditionEvaluatorFn } from "../types";

/**
 * @description Registro de funciones evaluadoras para operadores de condición relacionados con arrays.
 * Cada función toma un valor esperado (de la política) y un valor actual (del contexto)
 * y devuelve `true` si la condición se cumple, `false` en caso contrario.
 */
export const arrayEvaluators: Partial<
  Record<ConditionOperator, ConditionEvaluatorFn>
> = {
  /**
   * @param {any[]} expected - El array de valores que deben estar todos presentes en `actual`.
   * @param {any[]} actual - El array del contexto a evaluar.
   * @returns {boolean} `true` si todos los elementos de `expected` están en `actual`.
   */
  [ConditionOperator.ARRAY_CONTAINS]: (expected: any, actual: any) => {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    return expected.every((value) => actual.includes(value));
  },

  /**
   * @param {any[]} expected - El array de valores, donde al menos uno debe estar presente en `actual`.
   * @param {any[]} actual - El array del contexto a evaluar.
   * @returns {boolean} `true` si al menos un elemento de `expected` está en `actual`.
   */
  [ConditionOperator.ARRAY_CONTAINS_ANY]: (expected: any, actual: any) => {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    return expected.some((value) => actual.includes(value));
  },

  /**
   * @param {any[]} expected - El array de valores que no deben estar todos presentes en `actual`.
   * @param {any[]} actual - El array del contexto a evaluar.
   * @returns {boolean} `true` si no todos los elementos de `expected` están en `actual`.
   */
  [ConditionOperator.ARRAY_NOT_CONTAINS]: (expected: any, actual: any) => {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    return !expected.every((value) => actual.includes(value));
  },

  /**
   * @param {any[]} expected - El array con el que `actual` debe ser idéntico en contenido y orden.
   * @param {any[]} actual - El array del contexto a evaluar.
   * @returns {boolean} `true` si `actual` es igual a `expected`.
   */
  [ConditionOperator.ARRAY_EQUALS]: (expected: any, actual: any) => {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    if (expected.length !== actual.length) return false;
    return expected.every((val, idx) => val === actual[idx]);
  },

  /**
   * @param {number} expected - La longitud esperada del array `actual`.
   * @param {any[]} actual - El array del contexto a evaluar.
   * @returns {boolean} `true` si la longitud de `actual` es igual a `expected`.
   */
  [ConditionOperator.ARRAY_LENGTH_EQUALS]: (expected: any, actual: any) => {
    if (!Array.isArray(actual) || typeof expected !== "number") return false;
    return actual.length === expected;
  },

  /**
   * @param {number} expected - El valor con el que se compara la longitud de `actual`.
   * @param {any[]} actual - El array del contexto a evaluar.
   * @returns {boolean} `true` si la longitud de `actual` es menor que `expected`.
   */
  [ConditionOperator.ARRAY_LENGTH_LESS_THAN]: (expected: any, actual: any) => {
    if (!Array.isArray(actual) || typeof expected !== "number") return false;
    return actual.length < expected;
  },

  /**
   * @param {number} expected - El valor con el que se compara la longitud de `actual`.
   * @param {any[]} actual - El array del contexto a evaluar.
   * @returns {boolean} `true` si la longitud de `actual` es mayor que `expected`.
   */
  [ConditionOperator.ARRAY_LENGTH_GREATER_THAN]: (
    expected: any,
    actual: any
  ) => {
    if (!Array.isArray(actual) || typeof expected !== "number") return false;
    return actual.length > expected;
  },
};
