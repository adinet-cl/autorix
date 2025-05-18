/**
 * @file Archivo de entrada principal para la librería Autorix.
 * Exporta todos los componentes públicos necesarios para utilizar la librería.
 */
export * from "./core";
export * from "./interfaces";
export * from "./adapters";

export { AutorixPolicyEvaluator as PolicyEngine } from "./core/AutorixPolicyEvaluator";
export { AutorixVariableRegistry as VariableRegistry } from "./core/AutorixVariableRegistry";
export { AutorixConditionEvaluator as ConditionEvaluator } from "./core/AutorixConditionEvaluator";
export { ConditionOperator } from "./core/enums/conditions.enum";
export { InMemoryPolicyProvider } from "./adapters/InMemoryPolicyProvider";
