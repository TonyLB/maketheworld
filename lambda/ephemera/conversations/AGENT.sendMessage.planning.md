*Status: DESIGN NOTES - sendMessage enrichment boundary and migration prep.*

## Purpose

Document the current `sendMessage` architecture for conversations, the tensions discovered during the first `ConversationStep` vertical slice, and a migration starting point to realign with the intended `internalCache` usage pattern.

This is a planning input, not an implementation checklist.

## Planning intent (prototype de-locking)

The first vertical slice introduced useful scaffolding, but it should not be treated as a contract-locked architecture. We are explicitly willing to simplify and collapse prototype-only layering where it does not serve long-term clarity.

In particular, Option C should be evaluated on current needs rather than on preserving first-pass helper boundaries. A composite cache read shape (`get(...)` returning storable record plus runtime enrichment/handle) is in scope if it reduces call-path friction while keeping storage JSON-safe.

## Current architecture (as shipped in first vertical)

For `generateRoomPreview` conversations:

1. `internalCache.Conversations` stores JSON-safe records only (`StorableConversationRecord`).
2. `internalCache.Conversations.get(conversationId)` is a composite runtime read that returns `{ record, handle }`.
3. For `generateRoomPreview` rows, `handle` is a live capability built via `materializeGenerateRoomPreview(record, deps)` and exposes `sendMessage(...)`.
4. `materializeGenerateRoomPreview.sendMessage(...)` enriches local simplified args into shared `ConversationStep` wire shape and sends via `apiClient.send`.
5. `dataSource/renderOrchestration/generateRoomPreview` does not call the conversation system directly; it receives `onGenerating` callback as an injected option (and the caller invokes terminal `handle.sendMessage(...)` after orchestration returns).

### Why this worked for MVP

- Kept persisted/invocation cache rows JSON-safe.
- Allowed slow-path-only `generating` emission with minimal coupling to WebSocket delivery details.
- Preserved existing orchestration testability with callback injection.

## Tension discovered

The current calling path for conversation sending is layered:

- `internalCache.Conversations.get` -> composite `{ record, handle }`
- `materializeGenerateRoomPreview...` -> `sendMessage` enrichment and transport

This differs from the established project intuition where many functions treat `internalCache` as a global programming environment primitive and mock it directly in tests.

## Expected pattern (intent to preserve)

Desired direction discussed:

- Keep `internalCache.Conversations` as a JSON-safe store.
- But make read-time access naturally return an enriched shape for runtime use (or provide a first-class read API that does), so callers can depend on conversation primitives similarly to other cache primitives.
- Keep transport details (`apiClient`, WebSocket frame formatting) out of orchestration business logic.

In short: storage remains pure data; runtime reads can be enriched in a predictable, documented way.

## Explicit distinction to document in migration

If enrichment is moved closer to cache reads, the API contract must clearly state:

- `set(...)` accepts storable JSON-safe rows.
- runtime read API returns enriched handles (not the exact same type as stored rows).

Without this explicit distinction, the API will appear inconsistent and be easy to misuse.

## Design decision

### Chosen direction: Option C (composite `get`)

We are choosing Option C as the migration direction.

- Keep storage JSON-safe internally.
- Repurpose `internalCache.Conversations.get(...)` as a runtime read that can return both storable data and enrichment (for example `{ record, handle }`).
- Treat this as a simplification from prototype layering, not a compatibility obligation to preserve first-pass helper boundaries.

Decision rationale:

- Shortest call path at usage sites.
- Better fit with the internalCache-first programming model used elsewhere in the codebase.
- Current call sites do not require a separate raw-only method if storable fields remain first-class on the composite return.

Required guardrails for this choice:

- Preserve storable-vs-runtime distinction explicitly in naming and type docs (`record` vs `handle`).
- Keep set/get symmetry understandable: `set(...)` writes storable rows; `get(...)` is a composite runtime read.
- Keep materialization as the single envelope-injection point for wire messages.

### Considered and not chosen

- **Option A (registry-first enrichment):** kept as historical MVP layering; not chosen because the extra helper boundary no longer provides enough design value relative to call-path friction.
- **Option B (separate enriched read method such as `getHandle(...)`):** not chosen because it keeps dual-read indirection when a single composite `get` can express both concerns.

## Invariants to preserve regardless of option

- Stored conversation rows remain serializable and persistence-ready.
- Materialization remains the single place where envelope fields are injected into wire messages.
- `ConversationStep` remains the feedback mechanism for this vertical (`generating`, `complete`, `error`).
- Slow-path-only emission rule for `generating` remains enforced in orchestration.

## Migration prep checklist (for next planning doc)

- Implement internalCache-level composite read API (`get` returns storable + enrichment shape).
- Define API naming/docs to avoid set/get symmetry confusion.
- Update tests to match chosen primitive boundary (mock registry vs mock internalCache enriched read).
- Document the storable-vs-enriched type distinction in `conversations/AGENT.md` and type comments.

## Related files

- `lambda/ephemera/internalCache/conversations.ts`
- `lambda/ephemera/conversations/registry.ts`
- `lambda/ephemera/conversations/conversationTypes/generateRoomPreview/materialize.ts`
- `lambda/ephemera/dataSource/renderOrchestration/generateRoomPreview.ts`
- `lambda/ephemera/conversations/AGENT.planning.md`
- `lambda/ephemera/conversations/AGENT.planning.tasklist.md`
