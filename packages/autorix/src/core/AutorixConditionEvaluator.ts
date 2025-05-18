import {
  PolicyCondition,
  PolicyEvaluationContext,
  ConditionEvaluatorRegistry,
} from "./types";
import { ConditionOperator } from "./enums";
import { allEvaluators } from "./evaluators";

/**
 * Resuelve un valor anidado dentro de un objeto utilizando una cadena de ruta.
 * @param {Record<string, any>} obj - El objeto del cual resolver la ruta.
 * @param {string} path - La ruta al valor deseado (ej. "user.profile.name").
 * @returns {any} El valor encontrado en la ruta, o undefined si la ruta no existe.
 */
function resolvePath(obj: Record<string, any>, path: string): any {
  // biome-ignore lint/suspicious/noPrototypeBuiltins: <explanation>
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export class AutorixConditionEvaluator {
  private readonly evaluators: Readonly<ConditionEvaluatorRegistry>;

  constructor(customEvaluatorsInput?: Partial<ConditionEvaluatorRegistry>) {
    /**
     * @class AutorixConditionEvaluator
     * @description Evalúa las condiciones definidas en las políticas de Autorix.
     * Utiliza un registro de evaluadores de condiciones que puede ser extendido con lógica personalizada.
     * @param {Partial<ConditionEvaluatorRegistry>} [customEvaluatorsInput] - Un objeto opcional que contiene evaluadores de condiciones personalizados para agregar o sobrescribir los evaluadores por defecto.
     */
    const combinedEvaluators: ConditionEvaluatorRegistry = {
      ...allEvaluators,
      ...customEvaluatorsInput,
    };

    this.evaluators = Object.freeze(combinedEvaluators);
  }

  public evaluate(
    condition: PolicyCondition,
    context: PolicyEvaluationContext
  ): boolean {
    /**
     * Evalúa un objeto de condición de política contra un contexto de evaluación.
     * Itera sobre cada operador en el objeto de condición y utiliza el evaluador registrado
     * para determinar si la condición se cumple.
     * @param {PolicyCondition} condition - El objeto de condición de la política a evaluar.
     * @param {PolicyEvaluationContext} context - El contexto actual de evaluación que contiene los datos relevantes.
     * @returns {boolean} `true` si todas las condiciones se cumplen, `false` en caso contrario.
     * @throws {Error} Si se encuentra un operador de condición desconocido o no registrado.
     */
    for (const operatorKey in condition) {
      const operator = operatorKey as ConditionOperator;
      const evaluator = this.evaluators[operator];

      if (!evaluator) {
        throw new Error(
          `Operador de condición desconocido o no registrado: '${operator}'. Verifique la definición de la política y los evaluadores registrados.`
        );
      }

      const evaluationsAtOperator = condition[operator as ConditionOperator];
      if (!evaluationsAtOperator || typeof evaluationsAtOperator !== "object") {
        // Si las evaluaciones para un operador no son un objeto, se considera un error en la definición de la política.
        // Podría ser útil registrar una advertencia aquí si se espera que esto ocurra en escenarios válidos.
        return false;
      }

      for (const contextKey in evaluationsAtOperator) {
        const expectedValue = evaluationsAtOperator[contextKey];
        const actualValue = resolvePath(context, contextKey);

        if (!evaluator(expectedValue, actualValue, context)) {
          // Si alguna evaluación de condición individual falla, toda la condición del operador falla.
          return false;
        }
      }
    }
    // Si todas las condiciones para todos los operadores se cumplen, la condición general se considera cumplida.
    return true;
  }

  /**
   * Obtiene el registro de evaluadores de condiciones actualmente en uso.
   * El registro devuelto es de solo lectura para evitar modificaciones externas.
   * @public
   * @returns {Readonly<ConditionEvaluatorRegistry>} Un objeto de solo lectura que mapea los operadores de condición a sus funciones de evaluación.
   */
  public getEvaluators(): Readonly<ConditionEvaluatorRegistry> {
    return this.evaluators;
  }
}
