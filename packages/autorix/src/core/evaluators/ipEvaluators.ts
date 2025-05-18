import { ConditionOperator } from "../enums/conditions.enum";
import { ConditionEvaluatorFn } from "../types";

/**
 * Convierte una dirección IP v4 a su representación entera.
 * @private
 * @param {string} ip - La dirección IP en formato string (ej. "192.168.1.1").
 * @returns {number | null} La representación entera de la IP, o null si el formato es inválido.
 */
function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  return parts.reduce((acc, octet) => (acc << 8) + Number(octet), 0);
}

/**
 * Calcula la máscara de subred como un entero a partir del número de bits.
 * @private
 * @param {number} bits - El número de bits de la máscara de subred (ej. 24 para /24).
 * @returns {number} La máscara de subred como un entero.
 */
function calculateMask(bits: number): number {
  return bits === 0 ? 0 : (-1 << (32 - bits)) >>> 0;
}

/**
 * @description Registro de funciones evaluadoras para operadores de condición relacionados con direcciones IP.
 */
export const ipEvaluators: Partial<
  Record<ConditionOperator, ConditionEvaluatorFn>
> = {
  /**
   * Comprueba si la IP `actual` pertenece al rango CIDR o IP exacta `expected`.
   */
  [ConditionOperator.IP_MATCH]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;

    try {
      // si expected no contiene "/", tratamos como IP exacta
      if (!expected.includes("/")) {
        return ipToInt(expected) === ipToInt(actual);
      }

      const [rangeIpStr, subnetBitsStr] = expected.split("/");
      if (!rangeIpStr || !subnetBitsStr) return false;

      const subnetBits = parseInt(subnetBitsStr, 10);
      if (isNaN(subnetBits) || subnetBits < 0 || subnetBits > 32) return false;

      const actualIpInt = ipToInt(actual);
      const rangeIpInt = ipToInt(rangeIpStr);

      if (actualIpInt === null || rangeIpInt === null) return false;

      const mask = calculateMask(subnetBits);
      return (actualIpInt & mask) === (rangeIpInt & mask);
    } catch {
      return false;
    }
  },
  /**
   * Comprueba si la IP `actual` NO pertenece al rango CIDR `expected`.
   */
  [ConditionOperator.NOT_IP_MATCH]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;

    try {
      const [rangeIpStr, subnetBitsStr] = expected.split("/");
      if (!rangeIpStr || !subnetBitsStr) return false;

      const subnetBits = parseInt(subnetBitsStr, 10);
      if (isNaN(subnetBits) || subnetBits < 0 || subnetBits > 32) return false;

      const actualIpInt = ipToInt(actual);
      const rangeIpInt = ipToInt(rangeIpStr);

      if (actualIpInt === null || rangeIpInt === null) return false;

      const mask = calculateMask(subnetBits);
      return (actualIpInt & mask) !== (rangeIpInt & mask);
    } catch {
      return false;
    }
  },
  /**
   * Comprueba si la IP `actual` es exactamente igual a la IP `expected`.
   */
  [ConditionOperator.IP_EQUALS]: (expected, actual) => {
    if (typeof expected !== "string" || typeof actual !== "string")
      return false;

    return ipToInt(expected) === ipToInt(actual);
  },
};
