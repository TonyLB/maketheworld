# Coyote tropes implementation notes

Purpose: implementation-facing guidance for how trope metadata is represented during migration and how to evolve those contracts safely. Conceptual trope grounding remains in [`AGENT.tropes.md`](AGENT.tropes.md).

## First-pass narrowing contract

For object-level trope metadata, the first implementation pass uses free-text `narrowing` notes per trope fit instead of a strict enum.

- Keep notes concise and specific to how the object contributes in a candidate beat sequence.
- Prefer concrete functional phrasing over abstract labels.
- Avoid introducing enum-like codes in free text during this pass.

Rationale: free text keeps migration friction low while stable categories are still being discovered from live outputs and fixtures.

## Prospective enum families (do not enforce yet)

Candidate families for later tightening:

- implementation_form (device, bait, terrain_hazard, payload_delivery, condition_effect)
- activation_mode (pre_staged, remote_triggered, proximity_triggered, timed, contact)
- target_scope (coyote_self, road_runner, route_segment, area)
- certainty_axis (explicit_terminal, setup_only, bridge_link)

These are design candidates only. Do not make wire-format changes that require them until explicitly approved in a task plan.
