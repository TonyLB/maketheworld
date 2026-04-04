# Task planning (`taskPlanning/`)

This folder holds **task-scoped planning documents**: durable enough to survive multiple sessions and handoffs, but **not** a substitute for package- or system-level documentation elsewhere in the repo.

## Durability ladder

Think of documentation in four rough tiers:

| Tier | Examples | Expected lifetime |
| --- | --- | --- |
| Ephemeral | A single agent chat, scratch notes | Session only |
| **Task plans (this folder)** | `AGENT.<task>.planning.md` | Weeks to months; **dispose after the task is done** |
| Package / area docs | `charcoal-client/AGENT.md`, `*/AGENT.md`, `AGENT.testing.md` | Long-lived; update when behavior changes |
| Root navigation | [`AGENT.md`](../AGENT.md) | Long-lived index and conventions |

Task plans sit **above** chat: they record goals, ordering, progress, and verification so work can resume without re-deriving context. They sit **below** package docs: they should not duplicate architecture that belongs in `AGENT.md` files next to code.

## What belongs in a task plan vs elsewhere

**Keep in the task plan (process-oriented, task-only):**

- Current **status**, **progress** table, and **recommended order** for this initiative
- **Getting Started** tailored to this task (which docs to read first and why)
- **Verification** steps and grep commands for *this* slice
- Coordination notes (e.g. "land client before lambda") that matter only until the work ships

**Put in durable docs and link from the task plan:**

- How a subsystem works in steady state (belongs in the relevant `AGENT.md` or module doc)
- Testing standards, framework choice, and patterns (e.g. [`charcoal-client/AGENT.testing.md`](../charcoal-client/AGENT.testing.md))
- API contracts and types (package and interface docs)

**Rule of thumb:** If it would still be useful to a new contributor **after** this task is merged and the planning file deleted, it should live outside `taskPlanning/`, with the task plan pointing to it.

## Relationship to "Temporary Working Documents"

Root [`AGENT.md`](../AGENT.md) describes **temporary analysis** docs (often one-off deep dives with a cleanup checklist). Task plans are different: they are **tracked deliverables** for a known initiative, usually named `AGENT.<something>.planning.md`, with explicit phases. When the initiative completes, **archive or delete** the plan (and any obsolete temp analysis) so the folder does not accumulate stale process docs.

## Area-specific development notes

Subfolders under `taskPlanning/` may include **`AGENT.development.md`** (for example [`charcoal-client/AGENT.development.md`](charcoal-client/AGENT.development.md)). That file holds **lasting** tips for working in that part of the tree: how to run tests, which package docs to read, and links into the canonical testing documentation. Individual task plans should **link** there instead of duplicating commands.

Add `AGENT.development.md` when a subtree has non-obvious tooling (Vitest vs Jest, custom CLI, Lambda layout, etc.).

## Creating a new task planning document

1. **Choose a folder** under `taskPlanning/` that matches the code area (e.g. `charcoal-client/`, `lambda/ephemera/`). Create the folder if needed.
2. **Name the file** `AGENT.<shortTaskSlug>.planning.md` (or a consistent house pattern your team prefers).
3. **Link this framework** at the top or in **Getting Started**: readers should skim [`taskPlanning/AGENT.md`](AGENT.md) (this file) once so they understand durability and content split.
4. **Link area development notes** if present: e.g. [`charcoal-client/AGENT.development.md`](charcoal-client/AGENT.development.md) for client work.
5. **Follow the root [Getting Started pattern for complex tasks](../AGENT.md#getting-started-pattern-for-complex-tasks)** for the body: foundations, integration points, tests, baseline commands.
6. **Use the area `AGENT.development.md`** (or package testing docs) for **exact** test commands; do not rely on Jest-only examples from generic templates when the package uses Vitest or another runner.
7. **Include Progress** (table or checklist), **Recommended order**, and **Verification** so status is visible without rereading the whole file.

## Style recommendations

- **Status line** at the top: in progress / blocked / done, and what step is next.
- **Progress table** for multi-step initiatives; strike through or mark done items in **Recommended order** when helpful.
- **Relative links** to repo files (markdown links with paths from the task doc).
- **ASCII punctuation** in new content (match project rules for quotes).
- **Avoid** copying large blocks of architecture from package docs; link and add task-specific "what we are changing" only.

## When the task finishes

1. Move any **lasting** explanations into the appropriate `AGENT.md` or code-adjacent doc.
2. Remove or archive the task plan so `taskPlanning/` stays a **current** map of work, not a history museum (git retains history).
