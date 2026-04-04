*Status: SUPERSEDED --- content folded into `renderOrchestration`; stub until `state/` docs are consolidated.*

## Where the v2 orchestration plan lives

The **message-bus orchestration** narrative (lifecycle events, subsystem split, phased cascade, pointer migration) that used to live in this file is now maintained in:

- **[`../renderOrchestration/AGENT.planning.md`](../renderOrchestration/AGENT.planning.md)** --- section **Folded: state v2 orchestration plan (historical record)** plus the rest of that document for **current** tasks and wiring.

Do **not** duplicate orchestration roadmap here; **`renderOrchestration`** is the canonical home for that work.

## Why this stub exists

- **Single source of truth** for v2 orchestration planning (avoid `state/` vs `renderOrchestration/` drift).
- **`state/`** will later get **`AGENT.planning.history.md`** (condensed decisions) and a **perception-vertical** slice for state-package work; this file stays a **pointer** until that pass.

## Related pointers

| Topic | Document |
|-------|----------|
| Historical Room-state prototype (v1) | [`AGENT.v1.planning.md`](AGENT.v1.planning.md) |
| `mtw.ephemera.state` DataSource, State Change / Changed | [`AGENT.v3.planning.md`](AGENT.v3.planning.md) |
| State domain boundaries (short) | [`AGENT.md`](AGENT.md) |
| Cross-cutting perception vertical epic | [`../../AGENT.ephemeraPerceptionVertical.planning.md`](../../AGENT.ephemeraPerceptionVertical.planning.md) |
