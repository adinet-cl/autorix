# Express Adapter

The **@autorix/express** package provides first-class integration with Express.js.

---

## Setup

```ts
import { autorixExpress, authorize } from "@autorix/express";

app.use(
  autorixExpress({
    enforcer,
    getPrincipal: async (req) => req.user ?? null,
    getTenant: async (req) => req.user?.tenantId ?? null,
  })
);

app.get(
  "/users",
  authorize("user:list", { requireAuth: true }),
  (req, res) => res.json({ users: [] })
);
```

---

## Error Handling

```ts
import { autorixErrorHandler } from "@autorix/express";

app.use(autorixErrorHandler());
```