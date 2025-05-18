import { AutorixConditionEvaluator } from "./AutorixConditionEvaluator";
import { ConditionOperator } from "./enums";
import { AutorixVariableRegistry } from "./AutorixVariableRegistry";

/**
 * Define el tipo de efecto de una declaración de política.
 * - `allow`: Permite la acción.
 * - `deny`: Deniega la acción.
 */
export type EffectType = "allow" | "deny";

/**
 * Firma de una función evaluadora de condiciones.
 * @param {PolicyConditionExpectedValue} expected - El valor esperado definido en la política.
 * @param {PolicyContextActualValue} actual - El valor actual obtenido del contexto de evaluación.
 * @param {PolicyEvaluationContext} [context] - El contexto de evaluación completo, opcionalmente utilizado por algunos evaluadores.
 * @returns {boolean} `true` si la condición se cumple, `false` en caso contrario.
 */
export type ConditionEvaluatorFn = (
  expected: PolicyConditionExpectedValue,
  actual: PolicyContextActualValue,
  context?: PolicyEvaluationContext
) => boolean;

/**
 * @deprecated Este tipo es redundante, usar `ConditionEvaluatorFn` en su lugar.
 * Firma de una función evaluadora de condición individual.
 */
export type IndividualConditionEvaluatorFn = (
  expected: PolicyConditionExpectedValue,
  actual: PolicyContextActualValue,
  context?: PolicyEvaluationContext
) => boolean;

/**
 * Tipos de valores esperados que pueden ser definidos en una condición de política.
 */
export type PolicyConditionExpectedValue =
  | string
  | number
  | boolean
  | string[]
  | Date
  | null
  | undefined
  | object;

/**
 * Tipos de valores actuales que pueden ser obtenidos del contexto de evaluación.
 */
export type PolicyContextActualValue =
  | string
  | number
  | boolean
  | string[]
  | Date
  | null
  | undefined
  | object;

/**
 * Define la estructura de un objeto de condición de política.
 * Las claves son operadores de condición (`ConditionOperator`), y los valores son objetos
 * donde cada clave es una ruta a un valor en el contexto de evaluación, y el valor es el
 * valor esperado para esa condición.
 * @example
 * ```json
 * {
 *   "StringEquals": { "user.department": "sales" },
 *   "NumericLessThanEquals": { "request.size": 1024 }
 * }
 * ```
 */
export type PolicyCondition = {
  [Key in ConditionOperator]?: Record<string, PolicyConditionExpectedValue>;
};

/**
 * Representa una declaración individual dentro de una política de autorización.
 */
export interface PolicyStatement {
  /** El efecto de la declaración (permitir o denegar). */
  effect: EffectType;
  /**
   * Un array de acciones a las que se aplica esta declaración.
   * Puede usar comodines, ej. `["user:create", "user:delete", "document:*"]`.
   */
  action: string[];
  /**
   * El recurso o recursos a los que se aplica esta declaración.
   * Puede usar comodines, ej. `"arn:myapp:users/*"`, `"document/123"`.
   */
  resource: string;
  /**
   * Un objeto opcional que define condiciones adicionales que deben cumplirse
   * para que esta declaración de política sea efectiva.
   */
  condition?: PolicyCondition;
}

/**
 * Un registro que mapea operadores de condición (como cadenas) a sus funciones evaluadoras.
 */
export type ConditionEvaluatorRegistry = {
  [operator: string]: ConditionEvaluatorFn;
};

/**
 * Firma de una función que resuelve el valor de una variable de política.
 * @param {PolicyEvaluationContext} context - El contexto de evaluación actual.
 * @returns {any} El valor resuelto de la variable.
 */
export type VariableResolver = (context: PolicyEvaluationContext) => any;

/**
 * Un registro que mapea claves de variables a sus funciones resolvedoras.
 */
export interface VariableRegistry {
  [key: string]: VariableResolver;
}

/**
 * Contiene los datos contextuales relevantes para la evaluación de una política.
 * Puede ser extendido con propiedades personalizadas.
 */
export interface PolicyEvaluationContext {
  /** ID del usuario que realiza la solicitud (opcional). */
  userId?: string;
  /** ID del tenant o inquilino (opcional). */
  tenantId?: string;
  /** ID de la aplicación (opcional). */
  appId?: string;
  /** Indica si el usuario ha completado la autenticación multifactor (opcional). */
  mfaAuthenticated?: boolean;
  /** Permite propiedades adicionales y personalizadas en el contexto. */
  [key: string]: any;
}

export interface AutorixPolicyEvaluatorOptions {
  variableRegistry: AutorixVariableRegistry;
  conditionEvaluator?: AutorixConditionEvaluator;
}

export interface AccessEvaluationResult {
  allowed: boolean;
  reason?: string;
  matchedPolicy?: PolicyStatement;
}
