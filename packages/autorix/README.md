# ⚖️ Autorix

**Autorix** is a modern, secure, and flexible policy evaluation library for Node.js and TypeScript projects, including NestJS. It's built to support granular permission logic, custom context variables, and Attribute-Based Access Control (ABAC)-style condition evaluation. Inspired by AWS IAM and designed for extensibility, Autorix enables precise access control for SaaS platforms and enterprise-grade applications.

---

## ✨ Features

- **Declarative Policy Statements**: Define permissions using `allow` or `deny` effects for specific actions and resources.
- **Wildcard Support**: Use wildcards (`*`) in actions (e.g., `document:*`, `*:view`) and resources (e.g., `arn:myapp:documents/*`) for flexible matching.
- **ABAC-Style Conditions**: Implement fine-grained control with a rich set of condition operators (e.g., `StringEquals`, `NumericLessThan`, `IpMatch`, `DateInRange`).
- **Contextual Variables**: Securely resolve variables (e.g., `${user.id}`, `${request.ipAddress}`) within policy conditions based on the evaluation context.
- **Extensible Architecture**:
  - Customize condition evaluators by adding new operators or overriding existing ones.
  - Implement custom `PolicyProvider` interfaces to fetch policies from any data source (databases, external services, etc.).
- **Built-in `InMemoryPolicyProvider`**: Perfect for testing, development, or simple use cases.
- **Role & Group Policy Aggregation**: The `ExtendedPolicyProvider` interface supports fetching and combining policies from direct assignments, user roles, and user groups.
- **TypeScript First**: Fully typed for a better development experience and robust code.
- **NestJS Integration**: Easily integrate with NestJS applications using custom providers and guards.

---

## 🔑 Key Concepts

1.  **`PolicyStatement`**: The core of Autorix. A statement defines:

    - `effect`: `"allow"` or `"deny"`.
    - `action`: An array of action strings (e.g., `["document:read", "document:write"]`).
    - `resource`: A resource string (e.g., `"arn:myapp:documents/123"`).
    - `condition` (optional): An object defining conditions that must be met for the policy to apply.

2.  **`PolicyEvaluationContext`**: An object containing all relevant information for an access decision (e.g., current user details, request attributes like IP address, current time). This context is used to resolve variables in policy conditions.

3.  **`VariableRegistry`**: Manages custom variables (e.g., `user.id`, `request.ip`) and their resolver functions. These variables can be used in policy conditions like `${user.id}`.

4.  **`ConditionEvaluator`**: Evaluates the `condition` block of a policy statement. It uses a registry of operator functions (e.g., `StringEquals`, `NumericLessThan`) to compare expected values from the policy with actual values derived from the `PolicyEvaluationContext`.

5.  **`PolicyProvider`**: An interface responsible for fetching the applicable `PolicyStatement`s for a given subject (e.g., a user ID). You can implement this to load policies from a database, a file, or an external service. Autorix provides an `InMemoryPolicyProvider` for easy setup and testing.

6.  **`PolicyEngine` (alias for `AutorixPolicyEvaluator`)**: The main class that takes policies, an action, a resource, and a context to determine if access should be granted or denied.

---

## ⚙️ How it Works

Autorix evaluates access based on the following logic:

1.  **Explicit Deny Overrides**: If any applicable `PolicyStatement` has an `effect` of `"deny"` and its actions, resources, and conditions match the request, access is immediately denied.
2.  **Explicit Allow**: If no "deny" policies match, Autorix looks for an `PolicyStatement` with an `effect` of `"allow"` where actions, resources, and conditions match the request. If found, access is granted.
3.  **Default Deny**: If no policies explicitly deny or allow the request, access is denied by default.

---

## 🚀 Getting Started

First, install Autorix in your project:

```bash
npm install @adinet/autorix
```

### Project Setup

Create a policy evaluator:

```ts
import {
  AutorixPolicyEvaluator,
  AutorixVariableRegistry,
  PolicyStatement,
} from "autorix";

const registry = new AutorixVariableRegistry({
  "context.userId": (ctx) => ctx.userId,
  "context.mfaAuthenticated": (ctx) => ctx.mfaAuthenticated,
});

const evaluator = new AutorixPolicyEvaluator({ variableRegistry: registry });
```

---

## 📜 Example Policy

A `PolicyStatement` defines who can do what on which resources, and under what conditions.

```ts
const policy: PolicyStatement = {
  effect: "allow",
  action: ["document:read"],
  resource: "*",
  condition: {
    StringEquals: {
      userId: "${context.userId}",
    },
    Bool: {
      mfaAuthenticated: true,
    },
  },
};
```

---

## ✅ Policy Evaluation

```ts
const canAccess = evaluator.canAccess([policy], "document:read", "docs:123", {
  userId: "abc-123",
  mfaAuthenticated: true,
});

console.log(canAccess); // true or false
```

---

## 🧪 Testing with In-Memory Provider

```ts
import { InMemoryPolicyProvider } from "autorix";

const provider = new InMemoryPolicyProvider();
provider.setPoliciesFor("user-123", [policy]);

const policies = await provider.getPoliciesFor("user-123");
const allowed = evaluator.canAccess(
  policies,
  "document:read",
  "docs:1",
  context
);
```

---

## 🧠 Operators Supported

| Operator                | Description            |
| ----------------------- | ---------------------- |
| `StringEquals`          | Exact string match     |
| `Bool`                  | Boolean evaluation     |
| `NumericLessThanEquals` | Numeric comparison (≤) |

You can also define your own operators via the `ConditionEvaluator`.

---

## 💡 Advanced Usage Ideas

- Combine with NestJS guards to restrict route access
- Integrate with RBAC/ABAC user-role systems
- Use database-backed policy providers (TypeORM, Prisma, etc.)
- Generate permissions programmatically per tenant, user, or app

---

## 📂 Project Structure

```
src/
├── core/               # Main policy logic
├── storage/            # PolicyProvider interfaces & adapters
├── index.ts            # Export entry point
tests/                  # Unit tests
```

---

## 🛡 Author & License

Created with 💙 by [Adinet](https://github.com/Adinet-CL)  
MIT License
