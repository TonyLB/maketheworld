*Status: ACTIVE - completion goals for the perception vertical (unordered).*

## What this file is

A **completion rubric**: the **outcomes** we want the Ephemera **perception vertical** to satisfy before we would call the epic "done," expressed as checklists and nested sub-goals.

This is **not** a work queue. **Order is not implied.** Items can be advanced in parallel, revisited, or satisfied in different sequences depending on product pressure. Dependencies between areas still exist in code; they are **not** encoded as a top-to-bottom list here.

## What this file is not

- **Not** a replacement for [AGENT.ephemeraPerceptionVertical.planning.md](./AGENT.ephemeraPerceptionVertical.planning.md) (north-star narrative, scope table, document index).
- **Not** a task list. Short-term **tasks we intend to run next** belong in package task lists (e.g. [conversations/AGENT.planning.tasklist.md](./conversations/AGENT.planning.tasklist.md), render orchestration open work in `dataSource/renderOrchestration/AGENT.planning.md`) and normal issue tracking.
- **Not** a contract that finishing every box in one pass "ships the epic." Some goals are **continuous** (documentation hygiene); others may **split** across releases.

## How to use the rubric with task lists

| Artifact | Role |
|----------|------|
| **This rubric** | Answer: "What does 'done' mean for the vertical?" and "Which outcome are we weak on?" |
| **Task lists / issues** | Answer: "What are we doing **now** to move the rubric forward?" |

Task lists should **reference** rubric goals when helpful (e.g. "advances rubric: coherent readiness path") but the rubric must **not** be rewritten every time a sprint task changes. Decoupling avoids brittle "epic complete when checklist empty" failures.

---

## 1. Event-driven coordination

End state: producers publish **typed** events; consumers subscribe with **explicit correlation** (conversation, request, pipeline step) instead of ad hoc call chains.

- [ ] **Typed lifecycle and pipeline signals** are first-class (bus and/or DataSource streams), not only imperative calls between packages.
- [ ] **Correlation** is explicit at boundaries where multi-step UX or replay matters (not only implicit call stack).
- [ ] **Subscriber story** is documented: who listens to what, and what idempotency/ordering assumptions apply.

### Sub-goals

- [ ] State-driven refresh has a **canonical path** from authoritative state writes to render work (see also section 5).
- [ ] Render lifecycle signals (`RenderGenerationStarted`, `RenderReady`, cache outcomes, etc.) are coherent on the **passive / presence-driven** path (authoring **preview** branch removed).

---

## 2. Render cache as durable truth

End state: **long-lived render cache** is the durable substrate for **LLM-backed** descriptions; **deterministic fast paths** remain where the product allows.

- [ ] **Cache rows** and pointer policy are coherent with orchestration resolve (`findRender` / generation) without duplicate exact-match stacks.
- [ ] **Miss path** (generate + persist) and **hit path** are both well-defined relative to perception and conversations.
- [ ] **renderCache DataSource** outbounds (`Cache Updated`, errors) align with orchestration and perception needs where graduation requires it (no ambiguous "who owns durability" gaps).

### Sub-goals

- [ ] Call sites that only made sense for imperative **`sendPutCacheRecord`**-style flows are **migrated or justified** where a domain outbound is the right seam.
- [ ] **componentExamples** and other legacy call sites remain **accounted for** during incremental migration (no silent double-writes or races).

---

## 3. Fan-out and fan-in

End state: **renderOrchestration** fans **out** work by perspective/target; **perception** (or an equivalent assembler) can fan **in** fragments into coherent player-visible output without losing the user-visible story.

- [ ] **Orchestration** does not absorb enrichment/delivery concerns that belong in perception (or a dedicated layer).
- [ ] **Perception** (or successor) can **assemble** or **sequence** multi-source inputs (orchestration progress, cache events, presence) into **PublishMessage** / timeline rules where the product requires it.
- [ ] **Navigation / scale** constraints for perception are either addressed or explicitly accepted with a mitigation path (see `perception/AGENT.md` themes).

### Sub-goals

- [ ] **Placeholder vs final** behavior for slow paths is coherent across Room (and scoped extensions) without one-off hacks per call site.

---

## 4. Coherent "ready to show"

End state: **presentation** can rely on **one** notion of "ready for perception" without racing **write-through cache**, orchestration terminals, and perception delivery.

- [ ] **Hits** (no new cache write) and **misses** (generate + persist) both land in a **single observable readiness story** for clients where the product demands it.
- [ ] **No systematic races** between orchestration completion signals and **`renderCache`** durability that the UI cannot reason about.
- [ ] **Graduation** targets for render orchestration (authoritative outbounds, reduced conversation-only coupling) are either met or superseded by an explicit newer contract **documented** as such.

### Sub-goals

- [ ] Orchestration policy for intake errors and lifecycle messaging is **centralized** enough that new paths do not fork silently (see render orchestration planning).

---

## 5. State domain and passive refresh

End state: authoritative **`Meta::Room`** world-state and **`mtw.ephemera.state`** participate cleanly in the vertical; passive refresh does not depend on ad hoc **`sendRenderRequested`** from every writer.

- [ ] **State Change** / **State Changed** (and related envelopes) have a **documented** fan-out to orchestration with **observer policy** aligned to product (when to invalidate vs regenerate).
- [ ] Writers do not need **duplicate** triggers (legacy direct orchestration + new path) for the same logical state update without an explicit migration window.
- [ ] **State** package does not own orchestration concerns (pointers, resolve); boundaries stay sharp (see `dataSource/state/AGENT.md`).

### Sub-goals

- [x] **Duplicate orchestration-shaped** code in `state/` (parallel to `renderOrchestration`) is **removed**; canonical resolve/generation stays under `dataSource/renderOrchestration/` (see `dataSource/state/AGENT.md` and `dataSource/renderOrchestration/AGENT.md`).

---

## 6. Streams, contracts, graduation

End state: **internal bus** vs **`StreamingEvent` / DataSource** envelopes have a **clear** story for lifecycle and cache events; graduation criteria are satisfied or deliberately revised.

- [ ] **Subscriber registry** (or equivalent) exists where multiple consumers must coordinate on the same events without spaghetting imports.
- [ ] **Replay / durability** policy for perception-relevant streams is **explicit** (`replayable`, EventBridge, etc.) and matches product needs.
- [ ] **WebSocket / client** contract for passive refresh and lifecycle delivery is **documented** end-to-end (server planning + client lifeLine docs where applicable).

### Sub-goals

- [ ] **Conversations** correlation story (`conversationId` on cache traffic, etc.) is either **retired** or replaced by a **documented** correlation mechanism that orchestration and cache agree on.

---

## 7. Documentation and narrative hygiene

End state: one **epic narrative** does not fight five conflicting **ACTIVE** checklists; history stays **archived** without blocking forward motion.

- [ ] **Package-level** plans point here or to the epic for cross-cutting context; duplicate "north star" claims are avoided.
- [ ] **Historical** docs are labeled and linked; active docs name their scope.
- [ ] This **rubric** stays aligned with [AGENT.ephemeraPerceptionVertical.planning.md](./AGENT.ephemeraPerceptionVertical.planning.md) when epic goals or open themes **materially change** (occasional pass, not per-task).

### Sub-goals

- [ ] New contributors can answer "what is the perception vertical?" from the epic + rubric without reading every retired task list.

---

## References

- Epic narrative and index: [AGENT.ephemeraPerceptionVertical.planning.md](./AGENT.ephemeraPerceptionVertical.planning.md)
- Top-level Ephemera overview: [AGENT.md](./AGENT.md), [AGENT.event.md](./AGENT.event.md)
