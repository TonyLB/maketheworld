*Status: DESIGN NOTES - sendMessage enrichment boundary and migration prep.*

## Purpose

Document the current `sendMessage` architecture for conversations, the tensions discovered during the first `ConversationStep` vertical slice, and a migration starting point to realign with the intended `internalCache` usage pattern.

This is a planning input, not an implementation checklist.

## Current architecture (as shipped in first vertical)

For `generateRoomPreview` conversations:

1. `internalCache.Conversations` stores JSON-safe records only (`StorableConversationRecord`).
2. `registry.getConversationHandle(conversationId, deps)` reads the storable row from `internalCache.Conversations.get(...)`.
3. `materializeConversationHandle(...)` converts that storable row into a runtime handle with `sendMessage(...)`.
4. `materializeGenerateRoomPreview.sendMessage(...)` enriches local simplified args into shared `ConversationStep` wire shape and sends via `apiClient.send`.
5. `renderOrchestration/generateRoomPreview` does not call the conversation system directly; it receives `onGenerating` callback as an injected option.

### Why this worked for MVP

- Kept persisted/invocation cache rows JSON-safe.
- Allowed slow-path-only `generating` emission with minimal coupling to WebSocket delivery details.
- Preserved existing orchestration testability with callback injection.

## Tension discovered

The current calling path for conversation sending is layered:

- `internalCache.Conversations.get` -> storable row only
- `registry.getConversationHandle` -> runtime handle
- `materialize...` -> `sendMessage` enrichment and transport

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

## Concrete design options to evaluate

### Option A: Keep current separation (Registry as enrichment layer)

- Continue using:
  - `internalCache.Conversations.get` for storable rows
  - `registry.getConversationHandle` for enriched runtime handles
- Improve naming/docs/tests so this separation is obvious and intentional.

Pros:
- Minimal churn.
- Preserves current JSON-safe cache contract and existing call sites.

Cons:
- Extra helper layer remains compared to expected internalCache-first pattern.

### Option B: Add enriched read API on `internalCache.Conversations`

- Keep storage JSON-safe map unchanged.
- Add an explicit runtime read API (for example `getHandle(...)`) that materializes on read.
- Use that API from registry/app/orchestration glue.

Pros:
- Better alignment with "internalCache as global primitive" mental model.
- Keeps JSON-safe storage invariant intact.

Cons:
- Requires clear naming to avoid confusion with storable `get`.
- Requires call-site updates and test pattern migration.

### Option C: Overload/repurpose `get(...)` to return enriched handles

- Storage remains JSON-safe internally, but `get` return type becomes runtime handle.

Pros:
- Shortest call path at usage sites.

Cons:
- High ambiguity and potential breakage:
  - existing code uses `get` for existence checks and raw record reads
  - would force new methods for raw access anyway
- Most likely to confuse set/get symmetry.

## Invariants to preserve regardless of option

- Stored conversation rows remain serializable and persistence-ready.
- Materialization remains the single place where envelope fields are injected into wire messages.
- `ConversationStep` remains the feedback mechanism for this vertical (`generating`, `complete`, `error`).
- Slow-path-only emission rule for `generating` remains enforced in orchestration.

## Migration prep checklist (for next planning doc)

- Decide ownership boundary:
  - registry-first enrichment (Option A), or
  - internalCache-level enriched read API (Option B).
- Define API naming to avoid set/get symmetry confusion.
- Update tests to match chosen primitive boundary (mock registry vs mock internalCache enriched read).
- Document the storable-vs-enriched type distinction in `conversations/AGENT.md` and type comments.

## Related files

- `lambda/ephemera/internalCache/conversations.ts`
- `lambda/ephemera/conversations/registry.ts`
- `lambda/ephemera/conversations/materializeConversationHandle.ts`
- `lambda/ephemera/conversations/conversationTypes/generateRoomPreview/materialize.ts`
- `lambda/ephemera/renderOrchestration/generateRoomPreview.ts`
- `lambda/ephemera/conversations/AGENT.planning.md`
- `lambda/ephemera/conversations/AGENT.planning.tasklist.md`
