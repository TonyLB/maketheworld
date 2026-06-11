# AGENT documentation taxonomy  - migration runbook

**Durability:** Long-lived template in `taskPlanning/`. Do not delete when a single area migration finishes.

**Authoring rules (steady state):** See [**AGENT documentation taxonomy**](../AGENT.md#agent-documentation-taxonomy) in root [`AGENT.md`](../AGENT.md).

**Instantiate per area:** Copy [`AGENT.docMigration.planning.template.md`](AGENT.docMigration.planning.template.md) into the matching `taskPlanning/<area>/` folder, rename to `AGENT.<areaSlug>DocMigration.planning.md`, and work through it. Delete the planning file when the migration merges; git retains history.

---

## When to use this runbook

Use this process when:

- Adopting the taxonomy in an area that has never been organized.
- Correcting drift in an area that already has sibling files but `AGENT.md` (or another file) has absorbed the wrong content type.
- Splitting a composite legacy file (for example `AGENT.event.md`) into taxonomy siblings.

**Do not** use this runbook for normal feature work. When changing code, update only the bucket(s) that change affects --- often one, sometimes several (for example contract plus implementation); see root taxonomy **Touch policy**.

---

## Anti-patterns

1. **Big-bang repo-wide migration**  - migrate one high-churn or high-authority area at a time.
2. **Creating all sibling files up front**  - empty files become new drift sinks.
3. **Rewriting while migrating**  - doubles cost; move first, polish later (or never).
4. **Leaving normative content in `AGENT.md`** because it is the default grep target  - defeats the schema.
5. **Skipping authority updates**  - cursor rules, root navigation, and cross-package links must cite `AGENT.contract.md` (or the correct bucket), not a bloated `AGENT.md`.

---

## Phase 0  - Scope and target shape

**Goal:** Decide what files this area needs before moving content.

1. **Area root path**  - directory next to which docs live (for example `lambda/ephemera/internalCache/`).
2. **Inventory current docs**  - list every `AGENT*.md` under or pointing at this area.
3. **List authority consumers**  - from repo root:
   ```bash
   rg -l '<path-to-area>/AGENT' --glob '*.md' --glob '*.mdc'
   rg -l '<path-to-area>/AGENT' .cursor/
   ```
4. **Choose target file set**  - not "all buckets," only buckets with non-trivial content:

   | File | Include when |
   | --- | --- |
   | `AGENT.md` | **Always**  - identity, scope, entry links |
   | `AGENT.concepts.md` | Mental models or vocabulary **originated or anchored** here |
   | `AGENT.contract.md` | Falsifiable rules other areas or agents must obey |
   | `AGENT.navigation.md` | Dense cross-area link hub (horizontal doc graph) |
   | `AGENT.implementation.md` | Local map from behavior to source files (not code recapitulation) |
   | `AGENT.testing.md` | Non-obvious test conventions for this area |
   | `AGENT.usage.md` | Consumer cookbook (library-style external usage) |
   | `AGENT.planning.md` | Active initiative only  - prefer `taskPlanning/` disposable plans |

5. **Record in the area task plan**  - target checklist and rationale for each skipped bucket.

**Formula:** `target files = { AGENT.md } ∪ { bucket | area has non-trivial content matching bucket }`

---

## Phase 1  - Inventory, do not edit

**Goal:** Tag every section in drifted doc(s) without rewriting.

Read each source file and classify **sections** (headings and their bodies) using these tags:

| Tag | Destination |
| --- | --- |
| `identity` | `AGENT.md` |
| `concept` | `AGENT.concepts.md` |
| `contract` | `AGENT.contract.md` |
| `nav-out` | `AGENT.navigation.md` (links to other areas' docs) |
| `nav-in` | `AGENT.implementation.md` (links to local source files) |
| `test` | `AGENT.testing.md` |
| `usage` | `AGENT.usage.md` |
| `plan` | `taskPlanning/` plan or delete if shipped |
| `duplicate` | Link elsewhere; delete locally |
| `stale` | Verify against code; delete or move to contract after confirmation |

Record inventory in the area task plan (table: source file, section heading, tag, notes). An agent can complete this phase without moving prose.

**Disambiguation:**

- **Concept vs contract**  - concepts teach *what we mean*; contracts state *what must hold*. If removing it would not break an integration test, it is probably concept.
- **Navigation vs implementation**  - navigation links to **documentation nodes** in other systems; implementation links to **source files** in this area.
- **Contract vs implementation**  - "must use `internalCache.X.get`" is contract; "`get` lives in `renderCache.ts`" is implementation.

---

## Phase 2  - Split by move, not rewrite

**Goal:** Create only Phase 0 target files; move sections intact.

1. Create missing target files with the **header contract** (see root taxonomy).
2. **Cut-paste** whole sections from source into destination; add minimal connective sentences only.
3. Slim `AGENT.md` to one-screen entry: purpose, scope, non-goals, links to siblings.
4. Do **not** prose-polish in the same PR unless a moved section is actively wrong.
5. For composite legacy files (`AGENT.event.md`, etc.): split across contract + implementation + planning per inventory tags; remove or stub the legacy file when empty.

**Drift correction shortcut:** If siblings already exist, inventory only the bloated file, move outward, skip recreating the tree.

---

## Phase 3  - Stubs, redirects, and authority

**Goal:** Nothing important still points at the wrong file or section.

1. Update **in-repo links**  - `rg '<old-path>/AGENT\.md'` from repo root; fix relative links to new siblings.
2. Update **cursor rules** (`.cursor/rules/`) when they cite this area  - normative text should reference `AGENT.contract.md` where applicable.
3. Update **root [`AGENT.md`](../AGENT.md) Quick Navigation** if this area's entry structure changed.
4. Optional **stub** at old anchors in `AGENT.md`: one line *Moved to [`AGENT.contract.md`](./AGENT.contract.md#...).*
5. Delete empty legacy files rather than keeping placeholders.

---

## Phase 4  - Shrink and verify

**Goal:** Migration is done and won't immediately re-drift.

### Done criteria

- [ ] `AGENT.md` is roughly one screen (entry only).
- [ ] No duplicated section titles across siblings in this area (spot-check distinctive phrases).
- [ ] Normative "must / must not / primary vs secondary" lives in `AGENT.contract.md` (or is removed).
- [ ] `AGENT.implementation.md` does not state rules without a contract cross-link.
- [ ] Authority consumers from Phase 0 are updated.
- [ ] Smoke read: a newcomer can answer "what is this area for?" from `AGENT.md` alone.

### Verification commands (adjust paths)

```bash
# Stale links to old monolithic doc (replace PATH)
rg 'PATH/AGENT\.md' --glob '*.md' --glob '*.mdc'

# Normative language stranded in entry file (manual review of hits)
rg -n 'must not|must use|normative|primary vs secondary' PATH/AGENT.md

# Empty placeholder siblings
find PATH -name 'AGENT.*.md' -empty
```

### When the area task plan finishes

1. Merge durable doc changes.
2. Delete `taskPlanning/.../AGENT.<areaSlug>DocMigration.planning.md`.
3. Do **not** delete this runbook template.

---

## Suggested migration order (repo-wide initiatives)

Prioritize areas that are **high authority** (cited by cursor rules or many packages) or **high churn** (frequent implementation edits):

1. Packages cited by lambda cursor rules (for example `mtw-gateways`, `mtw-lambda-patterns` patterns).
2. Shared infrastructure (`internalCache`, `messageBus`, `dataSource` patterns).
3. Lambda roots with bloated `AGENT.md` or composite `AGENT.event.md`.
4. Thin leaf directories (often only need slim `AGENT.md` + upstream links  - fast wins).

**Reference shapes (already closer to target):**

- [`packages/mtw-lambda-patterns/ts/messageBus/`](../packages/mtw-lambda-patterns/ts/messageBus/)  - navigation + implementation + testing split.
- [`lambda/assets/messageBus/`](../lambda/assets/messageBus/)  - thin local index pointing at shared pattern docs.
- [`lambda/ephemera/dataSource/actions/`](../lambda/ephemera/dataSource/actions/)  - contract in `AGENT.md` + implementation sibling (candidate to move normative sections fully into `AGENT.contract.md` in a follow-up).
