import {
  PolicyStatement,
  PolicyEvaluationContext,
  PolicyCondition,
  AutorixPolicyEvaluatorOptions,
  AccessEvaluationResult,
} from "./types";
import { AutorixVariableRegistry } from "./AutorixVariableRegistry";
import { AutorixConditionEvaluator } from "./AutorixConditionEvaluator";

/**
 * @class AutorixPolicyEvaluator
 * @description Evalúa si un sujeto tiene permiso para realizar una acción sobre un recurso,
 * basándose en un conjunto de políticas y un contexto de evaluación.
 */
export class AutorixPolicyEvaluator {
  /** @private */
  private variableRegistry: AutorixVariableRegistry;
  /** @private */
  private conditionEvaluator: AutorixConditionEvaluator;

  /**
   * Crea una instancia de AutorixPolicyEvaluator.
   * @param {AutorixPolicyEvaluatorOptions} options - Opciones para configurar el evaluador de políticas,
   * incluyendo el registro de variables y opcionalmente un evaluador de condiciones personalizado.
   */
  constructor(private readonly options: AutorixPolicyEvaluatorOptions) {
    this.variableRegistry = options.variableRegistry;
    this.conditionEvaluator =
      options.conditionEvaluator || new AutorixConditionEvaluator();
  }

  /**
   * Comprueba si la acción solicitada coincide con alguna de las acciones definidas en la política,
   * soportando comodines.
   * @private
   * @param {string[]} policyActions - Acciones definidas en la política.
   * @param {string} requestedAction - Acción solicitada.
   * @returns {boolean} `true` si hay una coincidencia, `false` en caso contrario.
   */
  private actionsMatch(
    policyActions: string[],
    requestedAction: string
  ): boolean {
    return policyActions.some((policyAction) => {
      if (policyAction === "*" || policyAction === requestedAction) {
        return true;
      }
      if (policyAction.endsWith("*")) {
        const prefix = policyAction.slice(0, -1);
        if (requestedAction.startsWith(prefix)) {
          return true;
        }
      }
      if (policyAction.startsWith("*")) {
        const suffix = policyAction.substring(1);
        if (requestedAction.endsWith(suffix)) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Comprueba si el recurso solicitado coincide con el recurso definido en la política,
   * soportando comodines.
   * @private
   * @param {string} policyResource - Recurso definido en la política.
   * @param {string} requestedResource - Recurso solicitado.
   * @returns {boolean} `true` si hay una coincidencia, `false` en caso contrario.
   */
  private resourcesMatch(
    policyResource: string,
    requestedResource: string
  ): boolean {
    if (policyResource === "*" || policyResource === requestedResource) {
      return true;
    }
    if (policyResource.endsWith("*")) {
      const prefix = policyResource.slice(0, -1);
      if (requestedResource.startsWith(prefix)) {
        return true;
      }
    }
    if (policyResource.startsWith("*")) {
      const suffix = policyResource.substring(1);
      if (requestedResource.endsWith(suffix)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resuelve las variables de plantilla dentro de un objeto de condición de política.
   * @private
   * @param {PolicyCondition | undefined} condition - El objeto de condición de la política.
   * @param {PolicyEvaluationContext} context - El contexto de evaluación actual.
   * @returns {PolicyCondition | undefined} El objeto de condición con las variables resueltas,
   * o `undefined` si la condición original era `undefined` o vacía.
   */
  private resolvePolicyConditions(
    condition: PolicyCondition | undefined,
    context: PolicyEvaluationContext
  ): PolicyCondition | undefined {
    if (!condition || Object.keys(condition).length === 0) {
      return undefined;
    }
    const resolved = JSON.parse(
      JSON.stringify(condition, (key, value) => {
        if (typeof value === "string") {
          return this.variableRegistry.resolveTemplateString(value, context);
        }
        return value;
      })
    );
    return resolved;
  }

  /**
   * Evalúa si un conjunto de políticas de sujeto permite una acción específica sobre un recurso
   * dado un contexto de evaluación.
   * La evaluación sigue una lógica de "denegación explícita prevalece sobre permiso explícito".
   * Si no hay denegaciones explícitas y al menos una política de permiso coincide (y sus condiciones se cumplen),
   * se concede el acceso. Si ninguna política coincide, el acceso se deniega por defecto.
   * @param {PolicyStatement[]} subjectPolicies - Un array de declaraciones de política del sujeto.
   * @param {string} action - La acción que se intenta realizar (ej. "document:read").
   * @param {string} resource - El recurso sobre el que se intenta realizar la acción (ej. "arn:myapp:documents/123").
   * @param {PolicyEvaluationContext} context - El contexto de evaluación que contiene datos relevantes (ej. IP del usuario, hora actual).
   * @returns {AccessEvaluationResult} Un objeto que indica si el acceso está permitido, la razón y la política coincidente.
   */
  canAccess(
    subjectPolicies: PolicyStatement[],
    action: string,
    resource: string,
    context: PolicyEvaluationContext
  ): AccessEvaluationResult {
    // Fase 1: Evaluar todas las políticas de DENEGACIÓN (Deny)
    for (const policy of subjectPolicies) {
      if (policy.effect === "deny") {
        const actionMatches = this.actionsMatch(policy.action, action);
        const resourceMatches = this.resourcesMatch(policy.resource, resource);

        if (actionMatches && resourceMatches) {
          // La acción y el recurso coinciden con una política de denegación.
          const resolvedConditions = this.resolvePolicyConditions(
            policy.condition,
            context
          );

          const conditionResult =
            !resolvedConditions ||
            this.conditionEvaluator.evaluate(resolvedConditions, context);

          if (conditionResult) {
            return {
              allowed: false,
              reason: "ExplicitDeny",
              matchedPolicy: policy,
            };
          }
        }
      }
    }

    // Fase 2: Evaluar todas las políticas de PERMISIÓN (Allow)
    for (const policy of subjectPolicies) {
      if (policy.effect === "allow") {
        const actionMatches = this.actionsMatch(policy.action, action);
        const resourceMatches = this.resourcesMatch(policy.resource, resource);

        // LOGS PARA DEPURAR
        console.log(
          `[Policy Evaluation DEBUG] - Policy: ${JSON.stringify(policy.action)} / ${policy.resource}, Requested: ${action} / ${resource}, Matches: A=${actionMatches}, R=${resourceMatches}`
        );

        if (actionMatches && resourceMatches) {
          const resolvedConditions = this.resolvePolicyConditions(
            policy.condition,
            context
          );

          if (
            !resolvedConditions ||
            Object.keys(resolvedConditions).length === 0
          ) {
            return {
              allowed: true,
              reason: "ExplicitAllow",
              matchedPolicy: policy,
            };
          }
          const conditionEvalResult = this.conditionEvaluator.evaluate(
            resolvedConditions,
            context
          );
          if (!conditionEvalResult) {
            continue;
          }

          return {
            allowed: true,
            reason: "ExplicitAllow",
            matchedPolicy: policy,
          };
        } else {
          console.log(` Action or Resource did NOT match.`);
        }
      }
    }

    // Si ninguna política de 'deny' coincidió y ninguna política de 'allow' coincidió,
    // el resultado es 'false' (denegado por defecto).
    return { allowed: false, reason: "DefaultDeny" };
  }
}
