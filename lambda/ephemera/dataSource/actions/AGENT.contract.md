# `mtw.ephemera.actions` --- object manipulation pipeline contract

This file records **contracts** only. Mental models: [`AGENT.concepts.md`](./AGENT.concepts.md). Code map: [`AGENT.implementation.md`](./AGENT.implementation.md). The Acme `stableKey` contract still lives in [`AGENT.md`](./AGENT.md#acme-catalog-lines-and-stablekey-normative-contract).

---

## Grounding

- **Grounding is total.** It **must** be handed a complete `ReferentAssignment`. A referent with no `groundedId` and no entry in the namespace it needs **must** throw, as a construction bug; callers **must not** branch on it as a runtime outcome. (A derived referent the world cannot resolve is the assignment builder's to report, before Grounding runs.)
- **Enumerate owns the joint candidate space.** The product across an attempt's referents **must** be formed before Grounding, and a relation joining an object to itself **must** be dropped there. Grounding and Validation never see one.

## Plan

- **Plan's output is a set of ungrounded attempts, and every fallback emits that same type.** Plan never reads world state: its attempts carry no ids. Every fallback (identity-only, plan-only and joint) takes or proposes attempts, not families, so one producer handles them all.

## Validation

- **Validation never grows a candidate.** It checks a complete grounded candidate against what the world forbids, and **must not** re-check what Expansion just built.

## Command attempt

- **The result is derived, never stored.** An attempt's `result` (`pending` / `succeeded` / `impossible`) **must** be computed from its challenges' verdicts, and recording a verdict (`recordVerdict`, pure, addressed by challenge id) **must** be the only way it changes.
- **One impossible challenge refuses the whole attempt**, regardless of any other challenge's state.
- **A challenge propagates nothing.** What a met verdict permits is its own action's desired result; no verdict may widen another action.
- **Adjudicate runs actions-side, per candidate, before the dry run.** Verdicts **must** ride the published attempt. Positions honors them at commit and never judges --- that half of the rule is [`../positions/AGENT.contract.md`](../positions/AGENT.contract.md)'s (the `attempt` paragraph under the `mtw.ephemera.actions` ingress).
- **Every `transferMembership` carries its own preconditions and boundary expansion, whatever template produced it.** A transfer's moved object must sit in exactly one host, its `from` must be that host, and `from` must differ from `to`; a failed precondition is illegal, never a defer. Expansion adds the boundary dissolves and the exit-contact challenge from the object's source host, for take, drop and containment alike (ISS8203 slice 3).
- **Defer has one meaning: a challenge left pending.** A route may not add a defer reason of its own (a complexity LLM, an exit-edge flag). The deferred adjudication tier is the only place a pending challenge is judged, and until it has a judge the candidate abstains.
