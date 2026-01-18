import { describe, it, expect } from 'vitest';
import { evaluate, type PolicyDocument } from '../src';

const baseCtx = {
  principal: { id: 'u1', tenantId: 't1' },
  resource: { tenantId: 't1', ownerId: 'u1' },
  context: { scope: { type: 'TENANT', id: 't1' } },
};

describe('autorix/core evaluate', () => {
  it('defaults to deny when nothing matches', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Effect: 'Allow',
          Action: 'erp:sale:create',
          Resource: 'sale/*',
        },
      ],
    };

    const res = evaluate({
      action: 'erp:invoice:create',
      resource: 'invoice/123',
      policy,
      ctx: baseCtx,
    });

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('DEFAULT_DENY');
  });

  it('allows when action/resource match', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Sid: 'AllowInvoiceCreate',
          Effect: 'Allow',
          Action: 'erp:invoice:create',
          Resource: 'invoice/*',
        },
      ],
    };

    const res = evaluate({
      action: 'erp:invoice:create',
      resource: 'invoice/123',
      policy,
      ctx: baseCtx,
    });

    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('EXPLICIT_ALLOW');
    expect(res.matchedStatements).toEqual(['AllowInvoiceCreate']);
  });

  it('supports wildcard matching for actions', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Sid: 'AllowInvoiceAny',
          Effect: 'Allow',
          Action: 'erp:invoice:*',
          Resource: 'invoice/*',
        },
      ],
    };

    const res = evaluate({
      action: 'erp:invoice:delete',
      resource: 'invoice/123',
      policy,
      ctx: baseCtx,
    });

    expect(res.allowed).toBe(true);
  });

  it('applies Deny over Allow', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Sid: 'AllowAllInvoices',
          Effect: 'Allow',
          Action: 'erp:invoice:*',
          Resource: 'invoice/*',
        },
        {
          Sid: 'DenyDelete',
          Effect: 'Deny',
          Action: 'erp:invoice:delete',
          Resource: 'invoice/*',
        },
      ],
    };

    const res = evaluate({
      action: 'erp:invoice:delete',
      resource: 'invoice/999',
      policy,
      ctx: baseCtx,
    });

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('EXPLICIT_DENY');
    expect(res.matchedStatements).toEqual(['DenyDelete']);
  });

  it('evaluates StringEquals with variables', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Sid: 'AllowTenantMatch',
          Effect: 'Allow',
          Action: 'erp:invoice:create',
          Resource: 'invoice/*',
          Condition: {
            StringEquals: {
              'resource.tenantId': '${principal.tenantId}',
            },
          },
        },
      ],
    };

    const ok = evaluate({
      action: 'erp:invoice:create',
      resource: 'invoice/1',
      policy,
      ctx: baseCtx,
    });

    expect(ok.allowed).toBe(true);

    const bad = evaluate({
      action: 'erp:invoice:create',
      resource: 'invoice/1',
      policy,
      ctx: {
        ...baseCtx,
        resource: { ...baseCtx.resource, tenantId: 't2' },
      },
    });

    expect(bad.allowed).toBe(false);
  });

  it('evaluates Bool and NumericEquals', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Sid: 'AllowIfActiveAndLimit',
          Effect: 'Allow',
          Action: 'erp:sale:create',
          Resource: 'sale/*',
          Condition: {
            Bool: {
              'principal.isActive': true,
            },
            NumericEquals: {
              'principal.limit': 100,
            },
          },
        },
      ],
    };

    const ok = evaluate({
      action: 'erp:sale:create',
      resource: 'sale/1',
      policy,
      ctx: {
        ...baseCtx,
        principal: { ...baseCtx.principal, isActive: true, limit: 100 },
      },
    });

    expect(ok.allowed).toBe(true);

    const bad = evaluate({
      action: 'erp:sale:create',
      resource: 'sale/1',
      policy,
      ctx: {
        ...baseCtx,
        principal: { ...baseCtx.principal, isActive: false, limit: 100 },
      },
    });

    expect(bad.allowed).toBe(false);
  });

    it('supports Action/Resource as arrays', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Sid: 'AllowInvoiceOps',
          Effect: 'Allow',
          Action: ['erp:invoice:create', 'erp:invoice:update'],
          Resource: ['invoice/*', 'invoice/123'],
        },
      ],
    };

    const res = evaluate({
      action: 'erp:invoice:update',
      resource: 'invoice/999',
      policy,
      ctx: baseCtx,
    });

    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('EXPLICIT_ALLOW');
  });

  it('evaluates StringLike wildcard patterns', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Sid: 'AllowOwnerWildcard',
          Effect: 'Allow',
          Action: 'erp:invoice:create',
          Resource: 'invoice/*',
          Condition: {
            StringLike: {
              'resource.ownerId': 'u*',
            },
          },
        },
      ],
    };

    const res = evaluate({
      action: 'erp:invoice:create',
      resource: 'invoice/1',
      policy,
      ctx: baseCtx,
    });

    expect(res.allowed).toBe(true);
  });

  it('does not throw when a variable path is missing (it just does not match)', () => {
    const policy: PolicyDocument = {
      Statement: [
        {
          Sid: 'BadVarShouldNotMatch',
          Effect: 'Allow',
          Action: 'erp:invoice:create',
          Resource: 'invoice/*',
          Condition: {
            StringEquals: {
              'resource.tenantId': '${principal.nope}',
            },
          },
        },
      ],
    };

    const res = evaluate({
      action: 'erp:invoice:create',
      resource: 'invoice/1',
      policy,
      ctx: baseCtx,
    });

    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('DEFAULT_DENY');
  });

  it('throws a clear error when policy schema is invalid (validation on by default)', () => {
    const badPolicy: any = {
      Statement: [
        {
          Effect: 'ALLOW', // invalid
          Action: [],
          Resource: 123,
        },
      ],
    };

    expect(() =>
      evaluate({
        action: 'x:y:z',
        resource: 'r/1',
        policy: badPolicy,
        ctx: baseCtx,
      })
    ).toThrow();
  });

  it('can skip validation if you want (validate: false)', () => {
    const badPolicy: any = { Statement: [{ Effect: 'ALLOW', Action: [], Resource: 123 }] };

    const res = evaluate({
      action: 'x:y:z',
      resource: 'r/1',
      policy: badPolicy,
      ctx: baseCtx,
      validate: false,
    });

    // con policy malo, igual debería caer a default deny sin explotar
    expect(res.allowed).toBe(false);
  });

});
