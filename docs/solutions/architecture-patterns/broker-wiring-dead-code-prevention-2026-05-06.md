---
title: Broker Wiring — Prevent Dead-Code Shipping in Abstraction Layers
date: 2026-05-06
category: architecture-patterns
module: choreographer-acp-broker
problem_type: architecture_pattern
component: tooling
severity: critical
applies_when:
  - "Introducing a new abstraction layer (broker, adapter, middleware) between callers and callees"
  - "Migrating from direct subprocess spawns to an adapter/broker pattern"
  - "Multi-agent orchestration with multiple invocation paths"
  - "Closing a ship/milestone that claims resilience features are shipped"
tags:
  - acp-migration
  - broker-resilience
  - dead-code
  - security-regression
  - env-leak
  - wiring
  - multi-agent-orchestration
  - council-review
---

# Broker Wiring — Prevent Dead-Code Shipping in Abstraction Layers

## Context

The ACP migration (Ships 1-5) introduced a broker resilience layer at `core/runtime/broker.mjs` with circuit breaker, dead-letter queue, idempotency cache, and load queue. All primitives were well-tested in isolation (8 passing tests). However, a 5-member council review unanimously BLOCKed the merge because **zero production code actually called the broker**.

`companion.mjs` and `council.mjs` still used `runAgent` from `runners.mjs` directly — all Ship 2 resilience guarantees were bypassed in every real invocation. The broker was a library, not a system.

Compounding the issue: the new adapter path (`core/agents/*.mjs`) spawned subprocesses without `buildAgentEnv()`, leaking full `process.env` to child agents. The legacy `runners.mjs` path correctly scrubbed secrets. The migration moved invocations OFF the secure path — a net security regression invisible to `npm test`.

Key quote from council: "A circuit breaker that no caller flows through is a unit test, not a feature."

## Guidance

### 1. Verify production caller count, not just test coverage

After implementing any new abstraction layer, grep for production callers:

```bash
# Check broker is actually used in production paths
grep -rn "createBroker\|broker.invoke" core/ | grep -v "\.test\."
# Expected: hits in companion.mjs, council.mjs, etc.
# Red flag: only hits in test files and the definition itself
```

### 2. Wire the broker — in-process, per-invocation lifecycle

```javascript
import { createBroker } from './runtime/broker.mjs';

const broker = createBroker();
await broker.sessionStart(`command-${Date.now()}`);
try {
  const result = await broker.invoke({
    agentName: name,
    prompt: task,
    model, effort, timeout: 5 * 60_000,
    idempotencyKey: `${context}:${name}:${Date.now()}`,
  });
} finally {
  await broker.shutdown();
}
```

No detached process needed. Create, use, destroy per CLI invocation.

### 3. Break circular imports with a leaf module

When adapters need a utility from `runners.mjs` that also imports adapters:

```javascript
// core/env.mjs — zero internal imports, safe for both sides
export function buildAgentEnv(src = process.env) { ... }

// adapters import from env.mjs (no cycle)
import { buildAgentEnv } from '../env.mjs';

// runners.mjs re-exports for backward compat
export { buildAgentEnv } from './env.mjs';
```

### 4. Scrub env in ALL spawn paths — old and new

```javascript
const proc = spawn(binary, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: buildAgentEnv(),  // NEVER inherit process.env directly
});
```

### 5. Add ACP-to-native fallback in adapters

```javascript
async invoke(opts) {
  if (availability.transport === 'acp') {
    try { return await this._invokeAcp(opts); }
    catch { /* ACP failed — fall through */ }
  }
  return this._invokeNative(opts);
}
```

### 6. Deny permissions by default

```javascript
async requestPermission(params) {
  if (permissionAllowlist.has(params.tool_name)) return { outcome: 'allow' };
  return { outcome: 'deny' };
}
```

## Why This Matters

- **False sense of progress**: Tests pass, code exists, but the feature isn't shipped. Stakeholders believe Ship 2 is complete; it isn't.
- **Invisible security regressions**: New invocation paths bypass old safety mechanisms. `npm test` won't catch env leaks unless you test for them explicitly.
- **Compounding debt**: Every command added after the broker bypasses it too — the gap widens silently over time.

## When to Apply

- Before merging any PR that claims a new layer/pattern is "shipped"
- After introducing adapter, middleware, or proxy patterns
- During code review of multi-agent orchestration systems
- When a council or review tool flags "dead code" or "not wired"

## Examples

### Regression grep (add to CI or pre-merge checklist)

```bash
# All adapter spawns must use buildAgentEnv
grep -rn "spawn\|spawnSync" core/agents/ | grep -v "buildAgentEnv\|import\|node:child_process"
# Expected: 0 results

# No direct runAgent in production orchestration
grep -rn "runAgent(" core/companion.mjs core/council.mjs
# Expected: 0 results (only in imports/re-exports)

# Permission handler has no blanket allow
grep "outcome.*allow" core/agents/acp-client.mjs
# Expected: only the allowlist path
```

### Idempotency cache bounding (prevent memory leak)

```javascript
this.idempotencyMaxSize = 1000;
this.idempotencyTtlMs = 60 * 60 * 1000;

// On lookup:
const entry = this.idempotencyCache.get(key);
if (Date.now() - entry.t < this.idempotencyTtlMs) return entry.v;
this.idempotencyCache.delete(key); // expired

// On set:
if (this.idempotencyCache.size >= this.idempotencyMaxSize) {
  this.idempotencyCache.delete(this.idempotencyCache.keys().next().value);
}
this.idempotencyCache.set(key, { v: result, t: Date.now() });
```

## Related

- [ACP Migration Foundation](../architecture-patterns/acp-migration-foundation-2026-05-05.md) — broader architecture decisions (adapter-first vs ACP-first, transport strategy)
- [Council Decision](../../../debates/council/code-review-plan-implementation-6aaecd/decision.md) — the 5-member council review that surfaced these findings
- [Implementation Plan](../../plans/2026-05-06-council-fixes-implementation-plan.md) — step-by-step fix plan
- [Design Spec](../../specs/2026-05-06-council-fixes-design.md) — full design spec for the fix
