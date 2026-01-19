# Getting Started

This guide helps you get up and running with **Autorix** in a Node.js application.

---

## Installation

```bash
npm install @autorix/express
```

---

## Basic Usage

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
  "/admin",
  authorize("admin:access", { requireAuth: true }),
  (req, res) => res.json({ ok: true })
);
```
