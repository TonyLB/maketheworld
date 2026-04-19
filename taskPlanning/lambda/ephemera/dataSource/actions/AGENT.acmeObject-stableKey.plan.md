# Acme order objects: stable reference keys

**Status:** Planning. Foundational for downstream Coyote hypothesis / clustering work.

This document is task-scoped; retire it after shipping and move lasting contracts into [`lambda/ephemera/dataSource/actions/AGENT.md`](../../../../../lambda/ephemera/dataSource/actions/AGENT.md), [`packages/mtw-interfaces/ts/ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), and [`lambda/ephemera/dataSource/objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) as appropriate (see [`taskPlanning/AGENT.md`](../../../../AGENT.md)).

## Purpose

Today each Acme-delivered line becomes an [`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts) row with **`uuid`** (`OBJECT#...`) and display **`shortName`** from enrich ([`mergeAcmeOrderEnrich`](../../../../../lambda/ephemera/dataSource/actions/mergeAcmeOrderEnrich.ts), [`handleAcmeOrderAddObjects`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts)). **`shortName`** is human-facing copy and can repeat across orders or collide conceptually with objects already in the room.

**Goal:** Assign a **`stableKey`** per new object at Acme-order handling time --- suitable for **machine correlation** (seam headings, combine layers, tests, future indexing) independent of opaque **`uuid`**. Preferred base form is **slug-shaped** (`a-z` / `0-9` / `-`). **Uniqueness scope** is **Coyote-wide** (see below); enforcement **must** consume the **union of existing `stableKey` values** scraped from **`Meta::Room.objects`** across **all** Coyote game rooms --- not only the delivery room --- plus keys minted **earlier in the same Acme batch**.

**Disambiguation phases (decided):**

1. **LLM-first (semantic):** **Before** relying on numeric repair alone, steer the Acme Step B enrich **LLM** to propose **`stableKey`** candidates (**`string`** per line; **Phase 1 Step B enrich contract**) that **semantically disambiguate** when possible (e.g. **`rocket-high-powered`** rather than opaque duplicates) --- the model has the richest access to catalog gloss and intent. The enrich prompt **must** include the **Coyote-wide occupied-key list** so the model can steer away from keys already in use. That step may be **non-deterministic** across calls; proposals may still collide with each other, with **Coyote-wide** occupancy, or with **charset** rules.

2. **Post-LLM deterministic fallback:** **After** enrich returns, **pure code** validates each candidate against **Charset and normalization**, **`constructed-`** reservation, and **uniqueness** against the **occupied-key set**. Where the LLM **failed** to produce distinct valid labels (duplicates, collisions with existing keys, invalid characters), **repair deterministically** per **Deterministic numeric repair** below. This pass is the **contractual guarantee**; the LLM is an optimization for readable keys, not the sole authority.

**Deterministic numeric repair (decided):** When numeric suffix assignment is required (including **multiple** new lines that collide with each other **and** with an existing key, e.g. two new **`rocket2`** when **`rocket2`** is already occupied):

1. **Strip trailing numerics:** Remove the **maximal trailing run of ASCII digits** `0-9` from the candidate to obtain **`base`** (e.g. **`rocket2`** -> **`rocket`**). If there are **no** trailing digits, **`base`** is the whole candidate.

2. **First non-colliding suffix:** Among keys formed as **`base` immediately followed by a decimal integer with no separator** (e.g. **`rocket3`**), choose the **smallest** integer **`n`** such that **`base` + decimal(`n`)** is **not** in the **occupied set** --- existing Coyote-wide keys **plus** keys already finalized **earlier in this repair pass**. (Example: if **`rocket2`** is taken, the first free key is **`rocket3`**.)

3. **Multiple new lines** in the same collision family (same **`base`** after strip, still needing repair): assign **`base`+(n)**, **`base`+(n+1)**, **`base`+(n+2)**, ... in **deterministic batch order** (e.g. enrich line index), using the **`n`** from step 2 as the **starting** suffix for that family.

**No max length policy:** Human-scale orders will not produce impractically long **`stableKey`** strings; even extreme numeric suffix growth adds only a few characters --- **no** separate max-length cap is required for this strategy.

**Where deterministic enforcement runs (decided):** A **thin wrapper** in [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts) on the **Acme Order** path: after **`finalizeAcmeOrderFromStepB`** / merged enrich, gather **`getRoomMeta`** (or equivalent) for **each** Coyote game room to build the **occupied-key set**, invoke a **pure** **`finalizeStableKeysDeterministic`** (name TBD) module with LLM proposals + occupancy + batch ordering, then attach **final** keys before **`streamEvent`** / [`handleAcmeOrderAddObjects`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts).

**Uniqueness scope (decided):** **`stableKey`** is unique across the **entire union of staged objects in every Coyote game room** (same fixed room roster as hypothesis / [`defaultCoyoteGameData.gameRooms`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts); see [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)). Objects are **stored** per room; **`stableKey`** collisions are forbidden **across rooms** within that set.

**Field name (decided):** **`stableKey`** --- use this property on [`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), [`AcmeOrderPublishedOrder`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts), and Ephemera wire **`Object`** payloads. **Rationale:** **`slug`** describes a formatting style, not the role of the field; **`referenceKey`** is vaguer and overlaps with other "reference" language in APIs. **`stableKey`** reads as **durable logical identity** alongside mutable **`shortName`** display copy.

**Phase 1 Step B enrich contract (decided):** Step B structured output includes **`stableKey`** per catalog line as a **`string`** --- same field name and scalar type as persistence and downstream payloads. **[`buildParseAcmeOrderEnrichPrompt`](../../../../../lambda/ephemera/dataSource/actions/buildParseAcmeOrderEnrichPrompt.ts)** **must** embed the **Coyote-wide occupied-key list** (union of existing **`stableKey`** values from **`Meta::Room.objects`** across **all** Coyote game rooms) so the model can avoid taken keys **when semantics allow**; proposals may still collide internally or with charset rules, so **Deterministic numeric repair** remains mandatory.

**Charset and normalization (decided):** **`stableKey`** values use **ASCII lowercase letters `a-z`, digits `0-9`, and hyphen `-` only** (no underscores or spaces in stored keys; no other punctuation). Normalize display/catalog text toward this shape: fold case to lowercase; map whitespace and punctuation runs to a single hyphen; collapse repeated hyphens; trim leading/trailing hyphens. Digits may appear in the normalized base (from product names) and are explicitly allowed for **disambiguation suffixes** such as **`rocket2`** when collisions remain. **Reserved prefix:** keys beginning with **`constructed-`** are reserved for entities created later via **plan synthesis / construction** (not Acme mail-order). The Acme **`stableKey`** allocator MUST NOT emit values with that prefix; if normalization of a catalog line would yield a string starting with **`constructed-`**, apply a deterministic remap (e.g. prefix **`acme-`** or strip/replace the leading segment --- exact remap is part of implementation but must preserve uniqueness and charset rules).

**Disambiguation preference (decided):** **Semantic** hyphenated labels (e.g. **`rocket-high-powered`**) are **preferred for readability** and downstream Coyote reasoning; responsibility for **attempting** them sits primarily with the **LLM-first** phase. **Numeric suffix** repair (**`rocket2`**, **`rocket3`**, ...) is the **deterministic fallback** when the model did not yield unique, valid keys --- not an alternative first choice in code before consulting the LLM.

**Dependency:** [`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md) assumes durable, non-colliding logical refs on staged objects; this plan **should land first** or in tight sequence so clustering work can key clusters and combine output without ad hoc string matching on **`shortName`**.

## Success criteria (draft)

- Every object created from an **`Acme Order`** publish path carries **`stableKey`** --- **unique** among **`stableKey`** values across **all** Coyote game rooms' **`Meta::Room.objects`** after **post-LLM deterministic** enforcement (no duplicate keys in the union).
- **LLM-first** proposals are produced in Step B enrich (or equivalent); **then** the **deterministic fallback** builds the **occupied-key set** from **`stableKey`** on objects in **every** Coyote game room **plus** earlier lines in **this** batch, validates LLM output, and **repairs** collisions per **Deterministic numeric repair**; all within **`a-z` / `0-9` / `-`**. Persist only after repair completes.
- Types and bus payloads are extended consistently: [`AcmeOrderPublishedOrder`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts), [`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), [`handleAcmeOrderAddObjects`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts), and any guards / WML ephemera wire docs that must accept the new field.
- Unit tests cover: LLM proposes semantic keys when wired; **deterministic pass** fixes duplicate LLM output and **cross-room** clashes with **`rocket2`**-style suffixes; charset + **`constructed-`** remap; multi-line orders; legacy rows without **`stableKey`** (optional field + migration posture documented).

## Constraints and non-goals

- **Non-goal:** Renaming or migrating historical Dynamo rows in bulk (optional backfill or synthetic keys on read can be a follow-up).
- **Non-goal:** **`stableKey`** uniqueness outside the **Coyote game room** roster (non-demo rooms, other features) --- this contract is **Coyote play space** only.
- **Non-goal:** Treating LLM-proposed **`stableKey`** values as authoritative without the **post-LLM deterministic** pass (uniqueness must not depend on model reliability alone).
- **Constraint:** **`stableKey`** matches **Charset and normalization (decided)** above (single-line token; **`constructed-`** reserved for non-Acme synthesis).

## Unknowns and decisions

None at present.

## Getting started

Follow the ordered **categories** below (see [Getting Started pattern for complex tasks](../../../../../AGENT.md#getting-started-pattern-for-complex-tasks) in root [`AGENT.md`](../../../../../AGENT.md)).

1. **Understand task-plan conventions**
   - **Why:** [`taskPlanning/AGENT.md`](../../../../AGENT.md) (durability, checkbox rules).

2. **Read dependent downstream plan**
   - **Why:** Scope alignment with clustering / seam work.
   - **Focus:** [`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md).

3. **Trace Acme order flow**
   - **Why:** Stable keys attach to the merge + objects persist path; occupancy must aggregate **all** Coyote rooms.
   - **Focus:** [`parseCommand.ts`](../../../../../lambda/ephemera/dataSource/actions/parseCommand.ts), [`mergeAcmeOrderEnrich.ts`](../../../../../lambda/ephemera/dataSource/actions/mergeAcmeOrderEnrich.ts), [`publishedEvents.ts`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts), [`handleApiObjectsChange.ts`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts), [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md); room roster [`defaultCoyoteGameData.gameRooms`](../../../../../lambda/ephemera/internalCache/coyoteGame.ts) / [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md).

4. **Interfaces and persistence**
   - **Why:** New field must round-trip through merge, bus, and **`Meta::Room`**.
   - **Focus:** [`ephemeraMeta.ts`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts), [`mergePersistMetaRoomObjects.ts`](../../../../../lambda/ephemera/dataSource/objects/mergePersistMetaRoomObjects.ts) (exports **`mergeMetaRoomObjects`**, **`mergePersistMetaRoomObjects`**; see [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) **Persist**).

5. **Testing**
   - **Why:** Ephemera Jest from `lambda/ephemera`; see [`lambda/ephemera/AGENT.testing.md`](../../../../../lambda/ephemera/AGENT.testing.md).

6. **Identify next task**
   - **Why:** Progress lives in **Recommended order**.

## Recommended order

Pending work uses `[ ]` and completed work uses `[X]`. Apply checkboxes to each actionable line and nested bullets as they complete.

**Design note:** The behavioral contract for **`stableKey`** is specified under Purpose in **Disambiguation phases**, **Deterministic numeric repair**, **Where deterministic enforcement runs**, and **Phase 1 Step B enrich contract**. Implementation should link or summarize those headings from module docstrings on touchpoints ([`buildParseAcmeOrderEnrichPrompt`](../../../../../lambda/ephemera/dataSource/actions/buildParseAcmeOrderEnrichPrompt.ts), **`finalizeStableKeysDeterministic`** (TBD), [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts)) when wiring; durable narrative belongs in AGENT.md updates per the **Durable docs** checklist item when shipped.

- [X] **Design note:** Reference **Disambiguation phases**, **Deterministic numeric repair**, **Where deterministic enforcement runs**, and **Phase 1 Step B enrich contract** from Purpose in this section or module docstrings.
- [X] **Step B enrich:** Extend [`buildParseAcmeOrderEnrichPrompt`](../../../../../lambda/ephemera/dataSource/actions/buildParseAcmeOrderEnrichPrompt.ts) / JSON contract per **Phase 1 Step B enrich contract** --- **`stableKey`**: **`string`** per line; prompt **must** include **Coyote-wide occupied-key list** (semantic disambiguation first).
- [ ] **Deterministic enforcement:** Implement **`finalizeStableKeysDeterministic`** (name TBD) as **pure** logic: inputs = LLM-proposed **`stableKey`** per line + occupied set + batch line order; output = final keys per **Deterministic numeric repair** and charset / **`constructed-`** rules; legacy rows without **`stableKey`** contribute nothing to the occupied set.
- [ ] **Types:** Add optional then required **`stableKey`** on [`AcmeOrderPublishedOrder`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts) and [`EphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts); update guards ([`isAcmeOrderPublishedOrder`](../../../../../lambda/ephemera/dataSource/actions/publishedEvents.ts), [`isEphemeraMetaRoomObject`](../../../../../packages/mtw-interfaces/ts/ephemeraMeta.ts)); extend Step B JSON / [`coyotePlanAffinities`](../../../../../packages/mtw-interfaces/ts/coyotePlanAffinities.ts) normalization if enrich emits proposals.
- [ ] **Wire [`index.ts`](../../../../../lambda/ephemera/dataSource/actions/index.ts):** Thin wrapper after Step B merge per **Where deterministic enforcement runs** --- gather Coyote-wide occupancy, call **`finalizeStableKeysDeterministic`**, attach **final** keys before [`streamEvent`](../../../../../lambda/ephemera/dataSource/actions/index.ts) **`Acme Order`** and [`handleAcmeOrderAddObjects`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) (new objects still persist only to the character's **current** room).
- [ ] **Persist path:** Ensure **`mergePersistMetaRoomObjects`** stores **`stableKey`** on new rows; extend [`handleAcmeOrderAddObjects`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.ts) mapping from published order to **`add`** payload.
- [ ] **Tests:** Unit tests for allocator + [`mergeAcmeOrderEnrich.test.ts`](../../../../../lambda/ephemera/dataSource/actions/mergeAcmeOrderEnrich.test.ts) / [`handleApiObjectsChange.test.ts`](../../../../../lambda/ephemera/dataSource/objects/handleApiObjectsChange.test.ts) / [`index.test.ts`](../../../../../lambda/ephemera/dataSource/actions/index.test.ts) as touched.
- [ ] **Durable docs:** Update [`objects/AGENT.md`](../../../../../lambda/ephemera/dataSource/objects/AGENT.md) and [`lambda/ephemera/dataSource/AGENT.md`](../../../../../lambda/ephemera/dataSource/AGENT.md) if the DataSource index table should mention **`stableKey`**; link **`stableKey`** from [`coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md) staged snapshot section when Coyote consumes it.

## Verification

- `cd lambda/ephemera && npx jest dataSource/actions/ dataSource/objects/`
- Packages touched: `npx jest` or build per [`packages/mtw-interfaces`](../../../../../packages/mtw-interfaces/AGENT.md) conventions if types change.

## References

- Downstream: [`AGENT.clusteringRefinement.plan.md`](../coyoteGame/AGENT.clusteringRefinement.plan.md)
- Coyote staged objects: [`lambda/ephemera/dataSource/coyoteGame/AGENT.md`](../../../../../lambda/ephemera/dataSource/coyoteGame/AGENT.md)
- Action parse umbrella (related): [`AGENT.actionParse.plan.md`](AGENT.actionParse.plan.md)
