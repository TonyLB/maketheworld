# Ephemera Caching - Planning Document

**Status: First iteration complete; second iteration complete (steps 1-8).**

This document records the plan for the Ephemera-side caching and generation system for moment-to-moment descriptions, building on the Assets/WML blueprints.

## Architectural Context

### The Big Three Lambdas

- **WML Lambda**: Source of truth for content. Owns WML source files and StandardForm. Publishes Content Update, Zone Changed, Merge Conflict events.
- **Assets Lambda**: Authority over blueprints (lasting structure). Parses WML into components, maintains DynamoDB materialized views. Holds Examples, Guidance, Lens, and Marks as canonical definitions.
- **Ephemera Lambda**: Authority over moment-to-moment reality. Uses blueprints to produce what is actually shown now (and what has been shown) to characters. WebSocket, perception, message persistence, and blueprint reconciliation.

### Blueprint vs Moment-to-Moment

- **Assets** = lasting structure: Examples of what a Room might look like in various conditions (Lens, Guidance, Example tags). "Here is what the world is defined as."
- **Ephemera** = moment-to-moment reality: what things are like now, and what they have been like in slightly different situations. "Here is what is actually perceived now (and then)."

Ephemera builds on Assets blueprints to provide the living, cached instantiation of descriptions for specific world-states.

## Entangled Concerns

Several concerns will iterate together as we extend this system:

1. **Component state representation** - How we say "When X, Y, or Z" (Mark values, Match strings)
2. **Blueprint representation** - The Asset/WML side (Guidance, Examples, Lens, Marks)
3. **Description generation** - Likely Bedrock LLM with prompting and tool-use
4. **Caching** - Storage for search, reuse, and consistency
5. **Event streaming** - How we publish and consume generation/caching events

The final system will have many cooperating parts. We start with a minimal slice.

## First Iteration (MVP) - DONE

The first iteration is complete: exact-match Room preview, authored cache via invalidate-on-change and hydrate-on-resolve (see [`lambda/ephemera/dataSource/renderCache/AGENT.md`](dataSource/renderCache/AGENT.md)), Preview UI in the Room Workbench.

### Scope (as built)

- **Room only** - Start with cached Room descriptions; extend to Feature, Knowledge later.
- **Exact match first** - Find Example where Mark-pattern exactly matches proposed state. No fuzzy/semantic search yet.
- **Explicit generation** - Author triggers generation from Preview UI; no background/automatic generation.

### Open questions and assumptions (authoring tools)

- **Authoring-only WebSocket messages**:
  - For this MVP, `generateRoomPreview` is treated as a **development/authoring tool**, not a gameplay action:
    - We assume it does not require character/session context for permissions.
    - RoomId + markState + assetStack is considered sufficient for any Room the client can access in authoring mode.
  - Future iterations may tighten this:
    - E.g. restricting Preview to certain zones (Draft), assets owned by the player, or explicit authoring sessions.
    - Integrating `generateRoomPreview` with a more general “authoring API” permission model.

### Components

#### 1. Ephemera DynamoDB Schema

Create a representation in the Ephemera table that supports cached Room descriptions. Key structure and metadata design follow.

##### Layered resolution and perspective

Examples are not authored in a single asset; they are **resolved from an ordered stack of assets** (e.g. Asset A contributes description, Asset B overrides summary, Asset C overrides description). Merge order matters. The same logical Example can therefore produce different **rendered** content depending on which assets (and in what order) are in the resolution stack. We do not key or look up by Example ID alone; we store one cache record per distinct **render**, and identify that render by a **perspective**: the ordered asset stack that produced it.

##### Key Schema

- **EphemeraId**: `componentId` (e.g. `ROOM#...`, `FEATURE#...`, `KNOWLEDGE#...` - any component that can have Example references)
- **DataCategory**: `CACHE#${uuid}`

Use a **synthetic UUID** for each cache record (new UUID per put). Do not use the blueprint Example UUID in the key. Lookup is never "by Example ID"; we Query by componentId and filter in memory (exact match on markState; optionally by perspectiveId when the client sends an asset stack). This avoids assuming one unique render per (component, example) and supports multiple perspectives (asset stacks) and future constellation search.

This gives us:
- **Partition by component**: All cache records for a component share `EphemeraId`; Query fetches all candidates for exhaustive (and later constellation) search.
- **Opaque sort key**: Each record has a distinct `CACHE#uuid`; no searchable key by example or mark state at this point.

##### Record Metadata

**markState** - The Mark:Match pairs that define this Example's world-state slice (for exact-match comparison and constellation computation):

```typescript
{
  markValue: Array<{ mark: string, value: string }>  // mark = Mark UUID, value = Match string
}
```

Initial shape; allows adding a `remainder` field at a future juncture.

**renderedContent** - The cached output. Parallels Situation facet prose on Assets: `displayName`, `summary`, and `description` as RenderTree (same field names and format as Assets component records).

**provenance** - Source of the Example; supports author-provided vs. generated distinction and leaves room for confidence scores later:

```typescript
{ type: 'authored' | 'generated' }
```

For now, `type` alone is sufficient. Future fields (e.g. `confidence` for generated Examples) can extend this object without disturbing the overall data shape.

**perspectiveId** - Deterministic value identifying the **ordered asset stack** for which this cache item was generated. Compute as a hash (or canonical string) of the ordered list of asset IDs (e.g. `hash(assetStack.join(separator))`). Merge order is significant: the inheritance data on the client and backend deliberately preserves ordering. Stored on every record so we can later key or filter by perspective without schema change. Enables "show only cache entries relevant to this asset stack" and supports invalidation when an asset in the stack changes.

**Still to refine**:
- **Future**: Guidance-relevance scores, bucket membership for constellation search

#### 2. Ephemera Lambda Support

- Receive generation request (via WebSocket)
- Resolve proposed state to Example (exact Mark-pattern match)
- For exact match: can use Example DisplayName/Summary/Description directly (no LLM needed in v1)
- Write to cache (DynamoDB)
- Return cached result to requesting WebSocket session

#### 3. UI - Preview Section in Room Workbench

Add a Preview section to the Room editor in the Authoring Workbench that:

- Lets the author propose a state (set values for each Mark in the Room's Lens)
- Provides an explicit "Generate" command
- Sends request to Ephemera via WebSocket
- Displays the cached description when Ephemera returns it

#### 4. Integration Focus

- Test the full flow: propose state -> generate -> cache -> return -> display
- Refine exact-match logic (Mark-pattern to Example identification)
- Build structures that can later support LLM generation, fuzzy matching, and richer event streaming

### Alignment with Existing Schema

From `packages/mtw-wml/ts/standardize/components/AGENT.rendering.md`:

- **Lens**: References Marks via `marks: ReferenceList`. Room has `lens: SingleReference`.
- **Marks**: World-state dimensions. Each Mark has a Match value (MarkFacet payload string).
- **Examples**: Dense Mark coverage - values for all relevant Marks. DisplayName, Summary, Description.
- **Proposed state**: One Match value per Mark in the Room's Lens. This is what we compare against for exact Example lookup (not necessarily the storage key).

## Guidance-Constellation Search (Future Direction)

*Well past the first iteration. Documented here to avoid schema choices that paint us into a corner.*

### The Curse of Dimensionality

Keying by `RoomId + canonical Mark state` is expedient but likely wrong for the long term. Mark state is high-dimensional (one dimension per Mark in the Lens); exact-match keying does not scale or support semantic proximity.

### Guidance as Navigational Space

Each Example (authored or cached from a previous render) can be notionally located in a multidimensional space measured by the **relevance/proximity to each Guidance**:

- An Example of a Room in bright light: ~100% relevance to Guidance "Illumination: Bright", ~0-5% to "Illumination: Dark"
- A twilight Example: ~50% relevance to both
- These constellations of distance-to-Guidance are **component-specific** - they reflect the exact semantic space the component occupies

### Search Strategy (Future)

The number of Examples (including cached renders) is not large enough to justify a dedicated vector-search database. A plausible approach:

1. **Deterministic first sieve**: Bucket Examples by their top N guidance items
2. **Incoming query**: Compute constellation vector for the proposed state (relevance to each Guidance)
3. **Descent**: Walk buckets by descending relevance
4. **Comparison**: Deterministically compare constellation vectors against bucket members
5. **Output**: Subset of past Examples to use as prompts for an LLM rendering the new state

### Implication for Keying

Given this direction, we are unlikely ever to search by `RoomId + canonical Mark state`. We are far more likely to:

- **Use a synthetic UUID per cache record** (`CACHE#uuid`); do not key by Example ID or Mark state.
- **Search exhaustively** in early iterations (fetch by componentId, compare Mark patterns and optionally perspectiveId in memory).
- **Search by Guidance-constellation** in later iterations (buckets, vector comparison); **filter by perspectiveId** when the client sends an asset stack.

### Relationship to Situation + situation facets (shipped)

The WML model now uses **Situation** components (marks-only world-state slices) and **situation facets** on Room / Feature / Knowledge for parent-specific prose. See [`packages/mtw-wml/ts/AGENT.md`](../../packages/mtw-wml/ts/AGENT.md) and [`lambda/ephemera/dataSource/renderCache/AGENT.md`](dataSource/renderCache/AGENT.md).

This caching plan aligns with that model:

- Cache keys use synthetic `CACHE#uuid` values and store Mark:Match pairs directly, not Example IDs or a canonical `RoomId + Mark state` key.
- Each cache record is one row per distinct render, identified by component, Mark state, and perspective; Room records include optional **`situationId`** linking to the Situation uuid used for that slice.
- Wire events on **`mtw.assets.componentExamples`** still use historical **Example*** names; payloads use **`situationId`**, not **`EXAMPLE#`**.

## First Iteration Schema Implications

Given the Guidance-constellation future direction and layered asset resolution:

- **Use a synthetic UUID per cache record** (`DataCategory: CACHE#${uuid}`). Do not use `RoomId + Mark state` or Example ID as the DynamoDB key.
- **Store rich metadata** on each record: component reference, Mark state (Mark:Match pairs), rendered content, **perspectiveId** (hash of ordered asset stack). This supports exhaustive exact-match in v1 and future keying/filtering by perspective or constellation.
- **v1 lookup**: Fetch all cache records for the component, compare Mark patterns (and optionally perspectiveId when request includes asset stack) in memory. Acceptable while counts are small.
- **Leave room** for future fields: e.g. precomputed guidance-relevance scores, bucket membership for top-N Guidance; perspectiveId is already present for perspective-scoped search.

The schema supports "one cache row per distinct render" with perspectiveId and synthetic key, not "lookup by example or state key." That keeps options open.

## Design Notes

- **Exact match without LLM**: For v1, when Mark-pattern exactly matches an Example, we can return Example content directly. This keeps the first iteration simple and cost-free. Same cache schema serves both paths when we add LLM for non-exact states.
- **Event streaming**: MVP can start as request -> cache write -> single WebSocket response. Full EventBridge/streaming integration can layer on once the cache model stabilizes.

---

## Second Iteration - LLM for non-authored situations (complete)

**Goal:** When the author (or later, runtime) requests a description for a proposed Mark state and there is **no exact match** in the cache, use an LLM to produce one, then cache and return it. Naive first swing; avoid overengineering.

**Intended scope (to be refined):**

- Same entry point: `generateRoomPreview` (and eventually other component preview/generation flows).
- Flow: exact match as today -> if none, call LLM with enough context to describe the Room in the proposed state -> write result to cache with `provenance.type: 'generated'` -> return to client.
- Room-only for the first swing is likely enough; Feature/Knowledge can follow once the pattern is clear.

**Open questions (to answer before or during implementation):**

1. **Inputs to the LLM** – What does the model need? At minimum: Room identity/name, Lens/Mark definitions, proposed Mark state (Match values), and some nearby authored Examples (or their rendered text) as style/context. Do we need full Guidance text, or is "these are the Mark dimensions and these are example descriptions for other states" enough?
   - **First prototype:** Put everything we have into the prompt (Room, Lens, all Marks and Guidance, proposed state, all cached Examples for that component/perspective). Proof-of-concept goal: validate the flow and output shape. Once that works, we can tune context (subset of Examples, Guidance relevance, etc.) in a later iteration.
2. **Output shape** – We need `displayName`, `summary`, `description` as RenderTree. Does the LLM return plain text we wrap, or structured (e.g. JSON)? Do we need a single prompt or separate passes per field?
   - **First prototype:** Target JSON with three plain string fields (`displayName`, `summary`, `description`). We wrap each string in the minimal RenderTree form needed for the cache/UI. This does not exploit full RenderTree (e.g. inline markup, segments); we can work up to that in a later iteration.
3. **Choosing "nearby" Examples** – For a naive pass: do we send all cached Examples for the component (and perspective), or a small subset? If subset: by simple Mark-distance (e.g. fewest differing Marks), or do we defer any Guidance-constellation logic to a later iteration?
   - **First prototype:** Send all cached Examples for the component and perspective. Author will manually trim examples as they build up during testing so context does not become unduly large; we can add subset/ranking logic in a later iteration.
4. **Caching and invalidation** – Generated rows use the same schema as v1 (`provenance.type: 'generated'`). When do we invalidate them? Options: never (keep until explicit clear); when any Example for that Room is updated/removed; when the Room's Lens or Marks change. Start with a simple rule and document it.
   - **First prototype:** Do not invalidate generated rows. Keep until explicit clear (or manual/operational purge). Revisit invalidation rules in a later iteration.
5. **Model and cost** – Which Bedrock model(s), and do we care about latency vs. cost for the authoring Preview use case? Do we need a guardrail (e.g. max tokens, timeouts) before we ship?
   - **First prototype:** Try Nova 2 Lite with a reasonable cap on output (e.g. max tokens). We are not looking for deep cogitation—good-enough room descriptions with a lightweight model and limited latency/spend. Tune or upgrade model in a later iteration if needed.
6. **Failure handling** – LLM timeout or malformed output: return a clear error to the client and do not write to cache, or write a placeholder? Prefer "no write" for the first iteration to keep cache semantics simple.
   - **First prototype:** On timeout or malformed output, return a clear error to the client and do not write to cache. We are only using this in a developer-preview component; a clear error message is the right level for this prototype.

---

### High-level implementation plan (second iteration)

Review and refine this before moving to Plan mode. Order is approximate; some steps can be parallelized or split. The Lambda can accept and use optional `generationContext` first; the client can add assembly and sending of `generationContext` in parallel or after.

1. **Blueprint context for the LLM**  
   We need Room identity, Lens, Marks, Guidance, and proposed state in the prompt. Ephemera has the cache only; it does not read from Assets. **Proposal:** Extend the Preview WebSocket request with an optional payload that the client sends when it has the Room open.

   **Transport: WML string.** Use a WML string as the wire format for generation context (as we do elsewhere for schema/content transfer). We send a **StandardForm** WML chunk (an Asset with a subset of components), not a single StandardRoom WML chunk with Marks/Lenses/Guidance embedded inside it. The nested structure (Room references Lens, Lens references Mark, Room references Guidance, etc.) is much cleaner as a small StandardForm than as one flattened Room tag.

   **Building the subset: `StandardForm.subset()`.** Use `StandardForm.subset()` to construct the payload. The client has the full StandardForm for the open asset; call `form.subset([{ requestType: 'Full', keys: [roomKey], cascadeConditions: [...] }])` with cascade conditions that follow the appropriate reference types (e.g. `Direct` for Room -> Lens, Guidance, and Lens -> Mark) so the result includes the Room plus referenced Lens, Mark, and Guidance components. Serialize the returned StandardForm to WML via `schemaToWML([subsetForm.schema])` and send that string. Ephemera: parse the WML string with `StandardForm` (from `mtw-wml`, which Ephemera already depends on) to obtain the structure, then the prompt builder walks that StandardForm to build the prompt. Benefits: no one-off object shape; consistent with applyEdit, snapshots, and EventBridge WML payloads; schema evolution flows through; subset() and cascade already exist for "extract components plus minimal supporting context."

   **API contract:** Extend `GenerateRoomPreviewAPIMessage` in `packages/mtw-interfaces/ts/ephemera.ts` with an optional field (e.g. `generationContextWml: string` or `generationContext: string`) holding the WML string. The proposed Mark state stays in the request as `markState`. Ephemera uses the parsed generation-context structure plus cached Examples to build the prompt.
   - **Expedient for this prototype:** Client-supplied context is manual but sufficient. When implementing (API and client), add a comment that this is an expedient step. For future, less-manual generation we will likely want either: **(a)** a streaming data source *out of* `mtw.assets` to which the Ephemera lambda can subscribe, materializing a local mirror of relevant blueprint information; or **(b)** a read-only access pattern by which Ephemera can couple to the Asset data domain in certain specified situations (e.g. generation requests). Defer choosing between (a) and (b) until we need it.

   **Done.** Optional `generationContextWml` on `GenerateRoomPreviewAPIMessage`. Client: `buildGenerationContextSubset(form, roomKey)` in `charcoal-client/src/lib`, then `schemaToWML([subsetForm.schema])` in RoomPreviewEditor; sends WML in the request. Ephemera: app passes `request.generationContextWml` to `generateRoomPreview`; it parses with `new StandardForm(generationContextWml)` and holds `parsedContext` for the prompt builder (steps 2/3).

2. **Extend `generateRoomPreview` flow**  
   **Done.** Keep the existing exact-match path unchanged. When there is no exact match:
   - If we do not have enough context to call the LLM (no or invalid `generationContext`), return a clear error with `errorCode: 'CONTEXT_REQUIRED'`.
   - Otherwise: call the new LLM generation step (see item 3), then on success return `renderedContent`; on failure return an error and do not write. **Step 2 does not add write-to-cache on success** (the stub never returns success); the write is step 5.

   This item **calls** the LLM step; it does **not** implement the full LLM module (that is item 3). As part of item 2, introduce a **stub** LLM generation function with the same signature/contract that the real implementation will have. Until the stub is replaced (item 3), the stub can return the same "no exact match" result we return today (`NO_EXACT_MATCH`); the front-end already handles that, so the flow is wired and testable with no UI change.

   **Single response when LLM is involved:** Do not return an "accepted" message first. Returning "accepted" would resolve the client's `dispatchWebSocket` promise immediately, forcing the client to add a separate pub-sub subscription to the lifeline to match follow-up messages by RequestId. For the prototype, leave the request unresponded-to until the LLM finishes its work, then return the single result (or error). The client can show "Generating..." optimistically from send until the response arrives; the existing promise-based flow continues to work. **Future iteration:** Consider a WebSocket pattern that acts more like a stream or generator (multiple messages per logical request) so we can support "accepted" then "result" without overloading the current request-response promise. Document that when we revisit.

3. **LLM generation module (new)**  
   - **Inputs:** Room name, Lens/Marks/Guidance text, proposed mark state, and all cached Examples for the component and perspective (from `queryCacheRecordsForComponent` + filter by `perspectiveMatches`). Serialize into a single prompt.
   - **Prompt format:** Use a single prompt (system or user message) with plain-text sections for room, marks, proposed state, and examples. Instruct the model to respond with only a JSON object with keys `displayName`, `summary`, and `description` (plain strings).
   - **Invocation:** Bedrock with the current Nova 2 Lite model (use the current Bedrock model ID for Nova 2 Lite; check AWS docs or existing Bedrock usage in the repo). Set a max output tokens limit (e.g. 1024) and a request timeout (e.g. 30 seconds). On timeout or throttling, return a failure result.
   - **Output:** Expect a JSON object with three string fields: `displayName`, `summary`, `description`. Parse and validate; if missing or malformed, return failure (no cache write).
   - **Lambda timeout:** The Ephemera Lambda is now synchronously blocked on the LLM call for the generation path. Increase the Lambda's configured timeout so it is longer than the worst-case LLM duration; e.g. 60 seconds (Bedrock timeout plus buffer for prompt build and cache write). Document the chosen value in code or config.

   **Done.** `buildRoomDescriptionPrompt.ts` builds the prompt from StandardForm + markState + cachedExamples. `invokeBedrockRoomDescription.ts` calls Bedrock Converse API with model `us.amazon.nova-2-lite-v1:0`, 30s timeout, maxTokens 1024; client uses `AWS_REGION`. Parse/validate in `generateRoomDescription.ts` with resilient extraction (strip markdown code fences, take first `{`..`}`). Lambda timeout 60s and Bedrock IAM (inference profile + foundation model, region wildcard for cross-region routing) in template.yaml.

4. **RenderTree wrapping**  
   Add a small helper that turns a plain string into the minimal RenderTree form accepted by the cache and UI. Use the same RenderTree shape as existing cache and UI (e.g. a single text segment per field, consistent with how authored content is stored and with existing tests). Use it for all three fields before building the cache record.

   **Done.** Inlined in `generateRoomDescription.ts` as `toRenderTree(s)` (returns `s == null || s === '' ? [] : [s]`).

5. **Writing the generated result to the cache**  
   In `generateRoomPreview`, when the LLM step (item 3) returns success, call this before returning `renderedContent`. Step 2 does not add this branch (the stub never returns success). Technically we could return the render without caching; the write should follow shortly after step 3 so generated descriptions are reused. Production uses **`defaultPublishPutCacheRecord`** ( **`sendPutCacheRecord`** on **`api.ephemera`**; the WebSocket handler's terminal **`messageBus.flush()`** runs **`mtw.ephemera.renderCache`** so **`putCacheRecord`** and memo update apply) with:
   - `provenance.type: 'generated'`
   - `markState` = proposed state from the request
   - `renderedContent` = the wrapped displayName/summary/description
   - `perspectiveId` = compute from request `assetStack` (existing `computePerspectiveId`)
   - `perspectiveMatcher` = derive from request `assetStack` (e.g. `{ requiredAssetIds: assetStack, forbiddenAssetIds: [] }`) so future lookups for the same perspective match this record.

   **Done.** In `generateRoomPreview`, on LLM success we call **`publishPutCacheRecord`** with provenance `generated`, `computePerspectiveId(assetStack)`, and `perspectiveMatcher: { requiredAssetIds: assetStack, forbiddenAssetIds: [] }`, then return `renderedContent`.

6. **Result and error surface**  
   Use these error codes consistently: **`NO_EXACT_MATCH`** (unchanged; no cached Example matches the proposed state, and we are not attempting generation, e.g. missing context). **`CONTEXT_REQUIRED`** (no or invalid `generationContext`; client should send context to enable LLM generation). **`GENERATION_FAILED`** (LLM timeout or malformed output; do not write to cache). Extend client types so the Preview UI can show the message for each.
   - Exact match: same as today (`success: true`, `renderedContent`) in a single response.
   - No exact match, generation succeeded: `success: true`, `renderedContent` (client does not need to know it was generated). Response is sent when the LLM completes.
   - No exact match, generation failed: `success: false` with `errorCode: 'GENERATION_FAILED'` and `errorMessage`. Do not write to cache.

   **Done.** Lambda returns `NO_EXACT_MATCH`, `CONTEXT_REQUIRED`, and `GENERATION_FAILED` with `errorMessage`; client can surface these in the Preview UI.

7. **Client (Room Preview)**  
   When the author triggers Generate and we have no exact match, the client assembles the generation-context WML using `StandardForm.subset()` (request the Room with cascadeConditions so Lens, Mark, and Guidance are included), then `schemaToWML([subsetForm.schema])`. Send that string in the same request (e.g. `generationContext` or `generationContextWml`), then show "Generating..." from send until the single response arrives. On response, display the description or error. For `CONTEXT_REQUIRED`, show "No exact match; add generation context and retry" or similar; for `GENERATION_FAILED`, show the `errorMessage`.    Minimal client change: add the WML assembly and sending (field name per `GenerateRoomPreviewAPIMessage`), a "Generating..." wait state while the promise is pending, and handle `NO_EXACT_MATCH`, `CONTEXT_REQUIRED`, and `GENERATION_FAILED` in the response.

   **Done.** Client uses `buildGenerationContextSubset` and `schemaToWML`, sends `generationContextWml`; flow works end-to-end.

8. **Testing and guardrails**
   - Unit tests: prompt building (with mocked context and cached Examples), JSON parsing and validation, RenderTree wrapping, and the "no write on failure" path.
   - Integration-style test: mock Bedrock to return valid JSON or timeout; assert cache write only on success.
   - Manually: run Preview with a few Rooms and non-matching states; confirm Nova 2 Lite output is acceptable and latency/cost are within reason. Trim test data (Examples) as needed to keep context size manageable.

   **Done.** Unit tests: `buildRoomDescriptionPrompt.test.ts` (prompt sections and examples), `generateRoomDescription.test.ts` (valid JSON, markdown-wrapped JSON, Bedrock failure, malformed/missing fields), `generateRoomPreview.test.ts` (cachedExamples passed, `publishPutCacheRecord` on success). Manual run confirmed.

---

## Related Documentation

- [Ephemera AGENT.md](./AGENT.md) - Lambda overview and domain authority
- [Ephemera AGENT.event.md](./AGENT.event.md) - Event flow and WebSocket handling
- [Rendering Framework](../../packages/mtw-wml/ts/standardize/components/AGENT.rendering.md) - Guidance, Examples, Lens, Marks design
- [Rendering Development Status](../../packages/mtw-wml/ts/standardize/components/AGENT.rendering.development.md) - What is built vs. planned
- [Architecture Events](../../AGENT.architecture.events.md) - Domain-Authoritative Event Mesh
