import { ConditionOperator } from "../enums";
import { ConditionEvaluatorFn } from "../types";

/**
 * Escapa caracteres especiales de RegExp en un texto.
 * @private
 * @param {string} text - El texto a escapar.
 * @returns {string} El texto con los caracteres de RegExp escapados.
 */
const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Construye una expresión regular a partir de un patrón con comodines (donde '*' coincide con cualquier secuencia).
 * @private
 * @param {string} pattern - El patrón con comodines (ej. "user*").
 * @returns {RegExp} La expresión regular generada.
 */
const buildWildcardRegex = (pattern: string): RegExp => {
  return new RegExp("^" + escapeRegExp(pattern).replace(/\\\*/g, ".*") + "$");
};

/**
 * @description Registro de funciones evaluadoras para operadores de condición relacionados con cadenas de texto.
 */
export const stringEvaluators: Partial<
  Record<ConditionOperator, ConditionEvaluatorFn>
> = {
  /**
   * Comprueba si la cadena `actual` es igual a la cadena `expected`.
   */
  [ConditionOperator.STRING_EQUALS]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;
    return expected === actual;
  },

  /**
   * Comprueba si la cadena `actual` coincide con el patrón `expected` (que puede contener comodines '*').
   */
  [ConditionOperator.STRING_LIKE]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;
    const regex = buildWildcardRegex(expected);
    return regex.test(actual);
  },

  /**
   * Comprueba si la cadena `actual` contiene la subcadena `expected`.
   */
  [ConditionOperator.STRING_CONTAINS]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;
    return actual.includes(expected);
  },

  /**
   * Comprueba si la cadena `actual` comienza con la subcadena `expected`.
   */
  [ConditionOperator.STRING_STARTS_WITH]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;
    return actual.startsWith(expected);
  },

  /**
   * Comprueba si la cadena `actual` termina con la subcadena `expected`.
   */
  [ConditionOperator.STRING_ENDS_WITH]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;
    return actual.endsWith(expected);
  },

  /**
   * Comprueba si la cadena `actual` no es igual a la cadena `expected`.
   */
  [ConditionOperator.STRING_NOT_EQUALS]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;
    return expected !== actual;
  },

  /**
   * Comprueba si la cadena `actual` incluye alguna de las subcadenas en el array `expected`.
   * @param {string[]} expected - Un array de subcadenas a buscar.
   */
  [ConditionOperator.STRING_INCLUDES_ANY]: (expected, actual) => {
    if (!Array.isArray(expected) || typeof actual !== "string") return false;
    return expected.some(
      (value) => typeof value === "string" && actual.includes(value)
    );
  },

  /**
   * Comprueba si la cadena `actual` incluye todas las subcadenas en el array `expected`.
   * @param {string[]} expected - Un array de subcadenas a buscar.
   */
  [ConditionOperator.STRING_INCLUDES_ALL]: (expected, actual) => {
    if (!Array.isArray(expected) || typeof actual !== "string") return false;
    return expected.every(
      (value) => typeof value === "string" && actual.includes(value)
    );
  },
  /**
   * Comprueba si la cadena `actual` coincide con la expresión regular `expected`.
   */
  [ConditionOperator.STRING_REGEX]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;
    try {
      const regex = new RegExp(expected);
      return regex.test(actual);
    } catch {
      return false;
    }
  },
};
