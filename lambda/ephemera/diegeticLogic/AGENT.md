# Diegetic logic

Design home for **in-fiction consistency**: how play-time operations assert, revise, or withhold claims so stored graphs and player-facing material stay coherent for storytelling.

**Status:** v1 atomic **`takeHold`** and **`drop`** operators graduated (2026). Runtime code lives in ephemera lanes; this folder holds operator semantics and cross-lane navigation.

## Documentation

| Doc | Role |
| --- | --- |
| [**AGENT.concepts.md**](AGENT.concepts.md) | Core vocabulary and positive patterns |
| [**AGENT.operators.concepts.md**](AGENT.operators.concepts.md) | Shipped operator fiction + transcript obligations |
| [**AGENT.implementation.md**](AGENT.implementation.md) | Four-lane hub linking lane playbooks |
| [**AGENT.unknowns.concepts.md**](AGENT.unknowns.concepts.md) | Known vs unknown claims; how unknowns are manipulated *(stub)* |
| [**AGENT.navigation.md**](AGENT.navigation.md) | Cross-area links (positions, perception, WML, actions) |
| **AGENT.contract.md** | *(not yet drafted)* --- normative rules when a diegetic-only contract is needed |

## Charter

Diegetic logic governs **what the fiction is allowed to claim** when ephemera mutates play state --- enough structure for narrative copy, affordances, and generation context, without treating the world as a fully simulated physical space.

Operations proposed here are expected to **graduate** into existing lanes (`positions` for graph writes, `actions` for ingress, `perception` for presentation fan-in) rather than become a parallel DataSource by default.

## Non-goals (this package)

- **Narrative transcript** sort time and `MessageId` revision semantics --- [`../AGENT.narrativeTranscript.concepts.md`](../AGENT.narrativeTranscript.concepts.md)
- **Multi-channel** room header composition --- [`../AGENT.multiChannel.concepts.md`](../AGENT.multiChannel.concepts.md)
- **Play manipulation storage** (`ludicGraph`, adjacency, eviction ladder) --- [`../dataSource/positions/AGENT.concepts.md`](../dataSource/positions/AGENT.concepts.md)
- Coyote **beat-level** causal tropes --- [`../dataSource/coyoteGame/AGENT.md`](../dataSource/coyoteGame/AGENT.md)

## Graduation rule

When an operator or rule ships in code and tests, move its description from concepts here into the owning package's **contract** and **implementation** docs. Add a short pointer back from this folder if the design rationale remains useful. Examples: **`takeHold`** and **`drop`** --- operator prose in [`AGENT.operators.concepts.md`](AGENT.operators.concepts.md); ingress/apply in [`../dataSource/positions/AGENT.contract.md`](../dataSource/positions/AGENT.contract.md) and lane playbooks linked from [`AGENT.implementation.md`](AGENT.implementation.md).
