# Ephemera perception vertical (cross-cutting epic)

**Status: ACTIVE EPIC PLAN (living).** This file is the **north-star** plan for work that spans multiple Ephemera subsystems. It does not replace package-local AGENT notes; it **coordinates** them and records **discovered** sequencing. Subordinate planning docs remain the place for deep detail until we **condense** them (see [Documentation consolidation](#documentation-consolidation)).

## What this name means

**Perception vertical** = the end-to-end path from **world and pipeline events** (state, movement, assets, render lifecycle) to **what characters experience** (messages, headers, timelines), including **who computes what**, **where durability lives**, and **how correlation works** across steps.

This is **not** only the [`perception/`](perception/) folder. It **includes** orchestration, cache, conversations, DataSources, and `messageBus` boundaries between them.

## Scope (systems in play)

| Area | Role in the epic |
|------|------------------|
| [`dataSource/state/`](dataSource/state/) | Authoritative `Meta::Room` world-state, `mtw.ephemera.state`, `State Changed` and related ingress/outbound |
| [`dataSource/renderOrchestration/`](dataSource/renderOrchestration/) | Resolve / pointer / exact match / generation policy, passive and preview paths, lifecycle messages (`RenderReady`, etc.) |
| [`dataSource/renderCache/`](dataSource/renderCache/) | Dynamo cache rows, `mtw.ephemera.renderCache`, `Put Cache Record` / `Cache Updated` (today), future alignment with orchestration streams |
| [`renderCache/`](renderCache/) (module) | Types, helpers, schema; pairs with DataSource above |
| [`conversations/`](conversations/) | Correlation (`conversationId`), composite handles, `sendMessage`, staging for multi-step / preview UX |
| [`perception/`](perception/) | Enrichment and delivery into the chat spine; future **fan-in** assembler role |
| [`messageBus/`](messageBus/) | Internal typed messages vs `StreamingEvent` DataSource envelopes; graduation targets |
| [`internalCache/`](internalCache/) | Read-through caches, `ComponentRender`, `RenderCache`, etc. |

## Epic goal (as discovered)

1. **Move from** a primarily **imperative** pipeline (handlers call perception, cache, orchestration directly in ad hoc order) **toward** **event-driven coordination**: producers publish **typed** stream or bus events; consumers subscribe with **explicit correlation** (conversation, request, pipeline step).

2. **Treat long-lived render cache** as essential for **LLM-backed** descriptions (slow, expensive) while preserving **deterministic** fast paths where they exist.

3. **Separate concerns** without splitting the **user-visible story**: **renderOrchestration** fans **out** work by perspective/target; **perception** (or a dedicated assembler) fans **in** fragments into coherent player-visible output; **renderCache** remains the **durable** cache domain; **conversations** (or successors) hold **correlation** for multi-step UX.

4. **Align** `RenderReady`, cache persistence, and perception so that **presentation** can depend on **one** coherent notion of "ready to show" without racing the write-through cache.

This epic **subsumes the narrative** that started with **caching and generation** (see below) and grew into **state**, **orchestration**, and **delivery** boundaries.

## Contributing and subordinate planning documents

These documents **contributed** to the journey so far. They remain **authoritative for local detail** until consolidated; this file **indexes** them and records **cross-cutting** sequencing.

| Document | Role |
|----------|------|
| [AGENT.caching.planning.md](AGENT.caching.planning.md) | Early **Ephemera caching and generation** plan; blueprint vs moment-to-moment; MVP iterations; **entangled concerns** (state, generation, caching, streaming). Still valuable as **technical history** and cache-centric detail. |
| [renderCache/AGENT.md](renderCache/AGENT.md) | Schema, lookup model, links caching plan; implementation reference for cache rows. |
| [dataSource/state/AGENT.planning.historical.md](dataSource/state/AGENT.planning.historical.md) | **Historical** Room-state prototype (v1 era), v2 motivation snapshot; boundaries evolved (orchestration split out). |
| [dataSource/state/AGENT.planning.perceptionVertical.md](dataSource/state/AGENT.planning.perceptionVertical.md) | **`mtw.ephemera.state`** DataSource, `State Change` / `State Changed`, fan-out toward `RenderRequested`. |
| [dataSource/state/AGENT.md](dataSource/state/AGENT.md) | Domain boundaries for **state** vs orchestration. |
| [dataSource/state/AGENT.declutter.md](dataSource/state/AGENT.declutter.md) | Track B: orphaned `getOrStartRoomRenderForState` scaffold (scheduled removal). Parallel-track policy: [dataSource/renderOrchestration/AGENT.md](dataSource/renderOrchestration/AGENT.md) (*Parallel tracks and declutter*). |
| [dataSource/renderOrchestration/AGENT.md](dataSource/renderOrchestration/AGENT.md) | Current **renderOrchestration** package behavior, graduation gaps, preview vs passive. |
| [dataSource/renderOrchestration/AGENT.planning.md](dataSource/renderOrchestration/AGENT.planning.md) | Local **v2** tasks: lifecycle, `findRender`, intake, perception integration phases (*Folded: state v2 orchestration plan*). |
| [`dataSource/renderCache/index.ts`](dataSource/renderCache/index.ts) | `mtw.ephemera.renderCache` DataSource: put/delete **ingress**, **Cache Updated** / error **outbounds**. |
| [conversations/AGENT.md](conversations/AGENT.md) | Registry, handles, **temporary** `conversationId` on cache bus traffic. |
| [conversations/AGENT.planning.md](conversations/AGENT.planning.md) | **Cross-domain coordination**: fragments, assembly, correlation trap, multi-DataSource future. |
| [conversations/AGENT.planning.tasklist.md](conversations/AGENT.planning.tasklist.md) | Task sequencing for conversations work. |
| [conversations/AGENT.sendMessage.planning.md](conversations/AGENT.sendMessage.planning.md) | Send-message specifics if present. |
| [perception/AGENT.md](perception/AGENT.md) | Triggers, header semantics, migration context; **navigation** scale. |

## Journey so far (discovered milestones)

- **Caching plan** established why **persistent render cache** matters once **LLM generation** is in the loop; MVP and iterations landed in code and [AGENT.caching.planning.md](AGENT.caching.planning.md).
- **State** was split from ad hoc helpers into **`Meta::Room`**, **`mtw.ephemera.state`**, and **merge** semantics (see [state/AGENT.planning.historical.md](dataSource/state/AGENT.planning.historical.md) and [state/AGENT.planning.perceptionVertical.md](dataSource/state/AGENT.planning.perceptionVertical.md)).
- **Render orchestration** centralized **intake**, **`findRender`**, **pointer repair**, **generation** (`generateRoomPreview`), and **conversation-backed** terminals; **`RenderReady`** and friends live on the **messageBus** type union today, with **DataSource** ingress for requests and **state** fan-out for passive refresh.
- **Render cache DataSource** consumes **`api.ephemera` `Put Cache Record`** / **Delete**; orchestration **enqueues** puts via that API-shaped path; alignment with **pure orchestration outbounds** is an open **graduation** theme.
- **Conversations** planning articulated the **correlation** and **fragment assembly** problem explicitly (multi-step, perception, orchestration).

## Open themes (epic-level)

These are **themes**, not a duplicate of every checkbox in subordinate docs:

1. **Single observable "ready for perception" path** across **hits** (no new write) vs **misses** (generate + persist), without races between **orchestration** and **renderCache** durability.
2. **Stream vs messageBus** graduation for lifecycle events (`RenderReady`, progress, cache completion) and **subscriber** registry.
3. **Perception as fan-in** (or equivalent assembler): merge **orchestration progress**, **renderCache** outbounds, and **presence** into **PublishMessage** / timeline rules.
4. **Migration** off imperative **`sendPutCacheRecord`**-only stories where a **domain** outbound is the right seam (incremental; **componentExamples** and other call sites must stay accounted for).
5. **Documentation consolidation**: reduce duplicate **active** planning surfaces; retain **historical** records where useful (see below).

## Documentation consolidation

**Next step (process):** Trim **excessive** parallel **ACTIVE** checklists so one epic narrative does not compete with five **local** "last mile" tails. Likely pattern:

- Keep **this file** as the **epic index** and **current sequencing**.
- Mark **superseded** local plans **HISTORICAL** or merge their **remaining** items into **this** doc or into **one** package-level plan per area.
- Preserve [AGENT.caching.planning.md](AGENT.caching.planning.md) as **archive / technical depth** on cache evolution (similar to state v1), not as the **primary** north star.

**Related top-level navigation:** [AGENT.md](AGENT.md), [AGENT.event.md](AGENT.event.md).

## References

- Domain-authoritative and perception philosophy: [AGENT.md](AGENT.md) (overview and transition notes).
- Event flow overview: [AGENT.event.md](AGENT.event.md).
