import { ExtendedPolicyProvider } from "../interfaces/PolicyProvider";
import { PolicyStatement } from "../core/types";

/**
 * @class InMemoryPolicyProvider
 * @implements {ExtendedPolicyProvider}
 * @description Un proveedor de políticas en memoria para pruebas y desarrollo.
 * Almacena políticas, roles de usuario, políticas de roles, grupos de usuarios y políticas de grupos en objetos internos.
 */
export class InMemoryPolicyProvider implements ExtendedPolicyProvider {
  /** @private */
  private policies: Record<string, PolicyStatement[]> = {};
  /** @private */
  private userRoles: Record<string, string[]> = {};
  /** @private */
  private rolePolicies: Record<string, PolicyStatement[]> = {};
  /** @private */
  private userGroups: Record<string, string[]> = {};
  /** @private */
  private groupPolicies: Record<string, PolicyStatement[]> = {};

  /**
   * Establece las políticas directas para un sujeto (usuario).
   * @param {string} subjectId - El ID del sujeto.
   * @param {PolicyStatement[]} policies - Un array de declaraciones de política.
   * @memberof InMemoryPolicyProvider
   */
  setPoliciesFor(subjectId: string, policies: PolicyStatement[]): void {
    this.policies[subjectId] = policies;
  }

  /**
   * Obtiene las políticas directas para un sujeto (usuario).
   * Este método es parte de la interfaz `PolicyProvider` básica.
   * @param {string} subjectId - El ID del sujeto.
   * @returns {Promise<PolicyStatement[]>} Una promesa que resuelve a un array de declaraciones de política.
   * @memberof InMemoryPolicyProvider
   */
  async getPoliciesFor(subjectId: string): Promise<PolicyStatement[]> {
    return this.policies[subjectId] || [];
  }

  /**
   * Obtiene las políticas directamente asignadas a un usuario.
   * @param {string} userId - El ID del usuario.
   * @returns {Promise<PolicyStatement[]>} Una promesa que resuelve a un array de declaraciones de política.
   * @memberof InMemoryPolicyProvider
   */
  async getDirectUserPolicies(userId: string): Promise<PolicyStatement[]> {
    return this.policies[userId] || [];
  }

  /**
   * Obtiene los IDs de los roles asignados a un usuario.
   * @param {string} userId - El ID del usuario.
   * @returns {Promise<string[]>} Una promesa que resuelve a un array de IDs de roles.
   * @memberof InMemoryPolicyProvider
   */
  async getUserRoles(userId: string): Promise<string[]> {
    return this.userRoles[userId] || [];
  }

  /**
   * Obtiene las políticas asociadas a un rol específico.
   * @param {string} roleId - El ID del rol.
   * @returns {Promise<PolicyStatement[]>} Una promesa que resuelve a un array de declaraciones de política.
   * @memberof InMemoryPolicyProvider
   */
  async getRolePolicies(roleId: string): Promise<PolicyStatement[]> {
    return this.rolePolicies[roleId] || [];
  }

  /**
   * Asigna un rol a un usuario.
   * @param {string} userId - El ID del usuario.
   * @param {string} roleId - El ID del rol a asignar.
   * @memberof InMemoryPolicyProvider
   */
  assignRoleToUser(userId: string, roleId: string): void {
    if (!this.userRoles[userId]) this.userRoles[userId] = [];
    if (!this.userRoles[userId].includes(roleId)) {
      this.userRoles[userId].push(roleId);
    }
  }
  /**
   * Establece las políticas para un rol específico.
   * @param {string} roleId - El ID del rol.
   * @param {PolicyStatement[]} policies - Un array de declaraciones de política.
   * @memberof InMemoryPolicyProvider
   */
  setPoliciesForRole(roleId: string, policies: PolicyStatement[]): void {
    this.rolePolicies[roleId] = policies;
  }
  /**
   * Obtiene los IDs de los grupos a los que pertenece un usuario.
   * @param {string} userId - El ID del usuario.
   * @returns {Promise<string[]>} Una promesa que resuelve a un array de IDs de grupos.
   * @memberof InMemoryPolicyProvider
   */
  async getUserGroups(userId: string): Promise<string[]> {
    return this.userGroups[userId] || [];
  }

  async getGroupPolicies(groupId: string): Promise<PolicyStatement[]> {
    return this.groupPolicies[groupId] || [];
  }

  /**
   * Asigna un usuario a un grupo.
   * @param {string} userId - El ID del usuario.
   * @param {string} groupId - El ID del grupo.
   * @memberof InMemoryPolicyProvider
   */
  assignUserToGroup(userId: string, groupId: string): void {
    if (!this.userGroups[userId]) this.userGroups[userId] = [];
    if (!this.userGroups[userId].includes(groupId)) {
      this.userGroups[userId].push(groupId);
    }
  }
  /**
   * Establece las políticas para un grupo específico.
   * @param {string} groupId - El ID del grupo.
   * @param {PolicyStatement[]} policies - Un array de declaraciones de política.
   * @memberof InMemoryPolicyProvider
   */
  setPoliciesForGroup(groupId: string, policies: PolicyStatement[]): void {
    this.groupPolicies[groupId] = policies;
  }

  /**
   * Calcula y devuelve todas las políticas efectivas para un usuario.
   * Esto incluye políticas directamente asignadas, políticas de sus roles y políticas de sus grupos.
   * @param {string} userId - El ID del usuario.
   * @returns {Promise<PolicyStatement[]>} Una promesa que resuelve a un array consolidado de todas las declaraciones de política efectivas.
   * @memberof InMemoryPolicyProvider
   */
  async getEffectivePolicies(userId: string): Promise<PolicyStatement[]> {
    const [directPolicies, roleIds, groupIds] = await Promise.all([
      this.getDirectUserPolicies(userId),
      this.getUserRoles(userId),
      this.getUserGroups(userId),
    ]);

    const rolePoliciesArrays = await Promise.all(
      roleIds.map((roleId) => this.getRolePolicies(roleId))
    );

    const groupPoliciesArrays = await Promise.all(
      groupIds.map((groupId) => this.getGroupPolicies(groupId))
    );

    const rolePolicies = rolePoliciesArrays.flat();
    const groupPolicies = groupPoliciesArrays.flat();

    return [...directPolicies, ...rolePolicies, ...groupPolicies];
  }
}
