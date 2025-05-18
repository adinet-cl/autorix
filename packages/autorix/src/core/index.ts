/**
 * @file Archivo principal de exportación para el núcleo de Autorix.
 * Reexporta los componentes clave del sistema de evaluación de políticas.
 */
export { AutorixPolicyEvaluator as PolicyEngine } from "./AutorixPolicyEvaluator";
export * from "./AutorixConditionEvaluator";
export * from "./AutorixVariableRegistry";
export * from "./types";
export * from "./evaluators";
export * from "./enums";
