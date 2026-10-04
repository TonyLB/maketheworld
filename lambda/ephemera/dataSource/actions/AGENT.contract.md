# `mtw.ephemera.actions` --- object manipulation pipeline contract

This file records **contracts** only. Mental models: [`AGENT.concepts.md`](./AGENT.concepts.md). Code map: [`AGENT.implementation.md`](./AGENT.implementation.md). The Acme `stableKey` contract still lives in [`AGENT.md`](./AGENT.md#acme-catalog-lines-and-stablekey-normative-contract).

---

## Grounding

- **Grounding is total.** It **must** be handed a complete `ReferentAssignment`. A referent with no `groundedId` and no entry in the namespace it needs **must** throw, as a construction bug; callers **must not** branch on it as a runtime outcome. (A derived referent the world cannot resolve is the assignment builder's to report, before Grounding runs.)
- **The producer owns the joint candidate space.** The product across a `Change`'s referents **must** be formed before Grounding, and a relation joining an object to itself **must** be dropped there. Grounding and Validation never see one.

## Validation

- **Validation never grows a candidate.** It checks a complete grounded candidate against what the world forbids, and **must not** re-check what Expansion just built.

## Command attempt

- **The result is derived, never stored.** An attempt's `result` (`pending` / `succeeded` / `impossible`) **must** be computed from its challenges' verdicts, and recording a verdict (`recordVerdict`, pure, addressed by challenge id) **must** be the only way it changes.
- **One impossible challenge refuses the whole attempt**, regardless of any other challenge's state.
- **A challenge propagates nothing.** What a met verdict permits is its own action's desired result; no verdict may widen another action.
- **Adjudicate runs actions-side, per candidate, before the dry run.** Verdicts **must** ride the published attempt. Positions honors them at commit and never judges --- that half of the rule is [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md)'s (the `attempt` paragraph under the `mtw.ephemera.actions` ingress).
