import {
  PolicyEvaluationContext,
  VariableRegistry,
  VariableResolver,
} from "./types";

/**
 * @class AutorixVariableRegistry
 * @description Gestiona el registro y la resolución de variables personalizadas
 * que pueden ser utilizadas en las condiciones de las políticas.
 * Las variables se resuelven en tiempo de evaluación de la política utilizando el contexto actual.
 */
export class AutorixVariableRegistry {
  /** @private */
  private registry: VariableRegistry = {};

  /**
   * Crea una instancia de AutorixVariableRegistry.
   * @param {VariableRegistry} [initialRegistry] - Un registro inicial opcional de variables.
   */
  constructor(initialRegistry?: VariableRegistry) {
    if (initialRegistry) {
      this.registry = { ...initialRegistry };
    }
  }

  /**
   * Registra una nueva variable con su función resolvedora.
   * @param {string} key - La clave de la variable (ej. "currentUser.ipAddress").
   * @param {VariableResolver} resolver - La función que resolverá el valor de la variable
   * dado un contexto de evaluación.
   */
  register(key: string, resolver: VariableResolver): void {
    this.registry[key] = resolver;
  }

  /**
   * Resuelve el valor de una variable registrada utilizando el contexto de evaluación proporcionado.
   * @param {string} variableKey - La clave de la variable a resolver.
   * @param {PolicyEvaluationContext} context - El contexto de evaluación actual.
   * @returns {any} El valor resuelto de la variable.
   * @throws {Error} Si la variable no está registrada.
   */
  resolve(variableKey: string, context: PolicyEvaluationContext): any {
    const resolver = this.registry[variableKey];
    if (!resolver) {
      // Podría ser preferible devolver undefined o un valor especial en lugar de lanzar un error,
      // dependiendo de cómo se quiera manejar las variables no encontradas en las plantillas.
      // Por ahora, se mantiene el lanzamiento del error para una detección temprana de problemas.
      throw new Error(`Variable no registrada: ${variableKey}`);
    }
    return resolver(context);
  }

  /**
   * Resuelve una cadena de plantilla que contiene marcadores de posición de variables (ej. "User ID: ${user.id}").
   * @param {string} value - La cadena de plantilla a resolver.
   * @param {PolicyEvaluationContext} context - El contexto de evaluación actual.
   * @returns {string} La cadena con las variables resueltas.
   */
  resolveTemplateString(
    value: string,
    context: PolicyEvaluationContext
  ): string {
    return value.replace(/\${([^}]+)}/g, (_, varName) => {
      return this.resolve(varName, context);
    });
  }
  /**
   * Obtiene una copia del registro de variables actual.
   * @returns {VariableRegistry} El registro de variables.
   */
  getRegistry(): VariableRegistry {
    return this.registry;
  }
}
