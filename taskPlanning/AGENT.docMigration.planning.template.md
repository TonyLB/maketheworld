# Doc migration  - `<AREA_NAME>` (`<AREA_ROOT_PATH>/`)

**Status:** Not started | In progress | Blocked | Done

**Instructions:** Copy this file to `taskPlanning/<matching-area-folder>/AGENT.<areaSlug>DocMigration.planning.md`, replace placeholders, **fix relative links** in the table below for your folder depth, delete this paragraph, and delete the planning file when migration merges.

## Links

| Doc | Role |
| --- | --- |
| [`taskPlanning/AGENT.md`](./AGENT.md) | Durability ladder; task plan vs package docs *(from `taskPlanning/` root: `./AGENT.md`; from `taskPlanning/<area>/`: `../AGENT.md`; add one `../` per extra nesting level)* |
| [`AGENT.docTaxonomy.migration-runbook.md`](./AGENT.docTaxonomy.migration-runbook.md) | Durable migration phases 0--4 *(same depth as row above)* |
| [Root `AGENT.md` -- AGENT documentation taxonomy](../AGENT.md#agent-documentation-taxonomy) | Authoring rules for new content *(from `taskPlanning/<area>/`: `../../AGENT.md#...`; add one `../` per extra nesting level)* |

---

## Area scope

| Field | Value |
| --- | --- |
| **Area root path** | `<AREA_ROOT_PATH>/` (for example `lambda/ephemera/internalCache/`) |
| **Migration type** | New taxonomy / Drift correction / Legacy composite split |
| **Primary driver** | (why now  - authority pain, churn, cursor rule citation, etc.) |

---

## Phase 0  - Target file set

`AGENT.md` is always required. Check only siblings this area needs:

- [ ] `AGENT.md` (required)
- [ ] `AGENT.concepts.md`
- [ ] `AGENT.contract.md`
- [ ] `AGENT.navigation.md`
- [ ] `AGENT.implementation.md`
- [ ] `AGENT.testing.md`
- [ ] `AGENT.usage.md`

**Skipped buckets  - rationale:**

| Bucket | Skipped? | Why |
| --- | --- | --- |
| `AGENT.concepts.md` | | |
| `AGENT.contract.md` | | |
| `AGENT.navigation.md` | | |
| `AGENT.implementation.md` | | |
| `AGENT.testing.md` | | |
| `AGENT.usage.md` | | |

### Current docs inventory

| File | Lines (approx) | Notes |
| --- | --- | --- |
| | | |

### Authority consumers (update in Phase 3)

| Location | Cites | Action |
| --- | --- | --- |
| `.cursor/rules/` | | |
| Root `AGENT.md` Quick Navigation | | |
| Other packages | | |

---

## Phase 1  - Section inventory

Tag sections before moving. Add rows as needed.

| Source file | Section heading | Tag | Destination file | Notes |
| --- | --- | --- | --- | --- |
| | | `identity` / `concept` / `contract` / `nav-out` / `nav-in` / `test` / `usage` / `plan` / `duplicate` / `stale` | | |

---

## Recommended order

Pending work uses `[ ]`; completed work uses `[X]`. Mark nested lines `[X]` as each sub-step finishes.

- [ ] **Phase 0**  - Confirm target file set and authority consumer list
- [ ] **Phase 1**  - Complete section inventory (no prose moves yet)
- [ ] **Phase 2**  - Create target files with header contracts
- [ ] **Phase 2**  - Move sections (cut-paste; no rewrite pass)
- [ ] **Phase 2**  - Slim `AGENT.md` to entry-only
- [ ] **Phase 3**  - Fix in-repo links (`rg` for stale paths)
- [ ] **Phase 3**  - Update cursor rules / root navigation if needed
- [ ] **Phase 3**  - Remove or stub legacy composite files
- [ ] **Phase 4**  - Run verification commands from runbook
- [ ] **Phase 4**  - Smoke read `AGENT.md` as a new contributor
- [ ] **Close**  - Delete this planning file after merge

---

## Progress

| Phase | Status | Notes |
| --- | --- | --- |
| 0 Scope | | |
| 1 Inventory | | |
| 2 Split | | |
| 3 Authority | | |
| 4 Verify | | |

---

## Verification

Record exact commands and results for this area.

```bash
# Replace PATH with area root (directory containing AGENT.md)
rg 'PATH/AGENT\.md' --glob '*.md' --glob '*.mdc'
rg -n 'must not|must use|normative|primary vs secondary' PATH/AGENT.md
```

**Results:**

- 

---

## Post-merge

- [ ] Durable docs merged
- [ ] This planning file deleted (`git` retains history)
- [ ] No empty placeholder `AGENT.*.md` siblings left behind
