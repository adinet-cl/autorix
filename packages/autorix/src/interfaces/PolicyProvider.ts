import { PolicyStatement } from "../core/types";

/**
 * @interface PolicyProvider
 * @description Define la interfaz básica para un proveedor de políticas.
 * Un proveedor de políticas es responsable de recuperar las declaraciones de política
 * aplicables a un sujeto (por ejemplo, un usuario).
 */
export interface PolicyProvider {
  /**
   * Obtiene todas las políticas aplicables para un sujeto específico.
   * Esto podría incluir políticas directamente asignadas, o una combinación de políticas
   * basadas en roles, grupos, etc., dependiendo de la implementación.
   * @param {string} subjectId - El identificador único del sujeto (ej. ID de usuario).
   * @returns {Promise<PolicyStatement[]>} Una promesa que resuelve a un array de declaraciones de política.
   */
  getPoliciesFor(subjectId: string): Promise<PolicyStatement[]>;
}

/**
 * @interface ExtendedPolicyProvider
 * @extends PolicyProvider
 * @description Extiende la interfaz `PolicyProvider` con métodos más granulares
 * para obtener políticas basadas en usuarios, roles y grupos.
 * Esto permite una gestión y recuperación de políticas más estructurada.
 */
export interface ExtendedPolicyProvider extends PolicyProvider {
  /**
   * Obtiene las políticas que están directamente asignadas a un usuario específico.
   * @param {string} userId - El ID del usuario.
   * @returns {Promise<PolicyStatement[]>} Una promesa que resuelve a un array de declaraciones de política.
   */
  getDirectUserPolicies(userId: string): Promise<PolicyStatement[]>;

  /**
   * Obtiene los identificadores de todos los roles asignados a un usuario específico.
   * @param {string} userId - El ID del usuario.
   * @returns {Promise<string[]>} Una promesa que resuelve a un array de IDs de roles.
   */
  getUserRoles(userId: string): Promise<string[]>;

  /**
   * Obtiene todas las declaraciones de política asociadas a un rol específico.
   * @param {string} roleId - El ID del rol.
   * @returns {Promise<PolicyStatement[]>} Una promesa que resuelve a un array de declaraciones de política.
   */
  getRolePolicies(roleId: string): Promise<PolicyStatement[]>;

  /**
   * Obtiene los identificadores de todos los grupos a los que pertenece un usuario específico.
   * @param {string} userId - El ID del usuario.
   * @returns {Promise<string[]>} Una promesa que resuelve a un array de IDs de grupos.
   */
  getUserGroups(userId: string): Promise<string[]>;

  /**
   * Obtiene todas las declaraciones de política asociadas a un grupo específico.
   * @param {string} groupId - El ID del grupo.
   * @returns {Promise<PolicyStatement[]>} Una promesa que resuelve a un array de declaraciones de política.
   */
  getGroupPolicies(groupId: string): Promise<PolicyStatement[]>;
}
