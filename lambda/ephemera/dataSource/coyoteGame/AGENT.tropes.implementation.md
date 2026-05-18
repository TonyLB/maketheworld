# Coyote tropes implementation notes

Purpose: implementation-facing guidance for how trope metadata is represented during migration and how to evolve those contracts safely. Conceptual trope grounding remains in [`AGENT.tropes.md`](AGENT.tropes.md).

## First-pass narrowing contract

For object-level trope metadata, the first implementation pass uses free-text `narrowing` notes per trope fit instead of a strict enum.

- Keep notes concise and specific to how the object contributes in a candidate beat sequence.
- Prefer concrete functional phrasing over abstract labels (**causal tropes only**; see Scene Dressing below).
- Avoid introducing enum-like codes in free text during this pass.

Rationale: free text keeps migration friction low while stable categories are still being discovered from live outputs and fixtures.

## Scene Dressing narrowing (enrich time)

Conceptual grounding: [`AGENT.tropes.md`](AGENT.tropes.md) (Scene Dressing section). Acme enrich prompt authority: [`../actions/enrich/acmeOrder/buildPrompt.ts`](../actions/enrich/acmeOrder/buildPrompt.ts).

**Grain:** `narrowing` on **Scene Dressing** rows names an **aesthetic or material category**, not Coyote-vs-Road-Runner mechanics and not a scenario or archetype label.

| Good (category) | Wrong (scenario / archetype at enrich) |
| --- | --- |
| `"racing gear"`, `"protective equipment"` | `"aviation"`, `"high-speed chase"` |
| `"scientific apparatus"`, `"adventurous clothing"` | `"mad science lab"`, `"trap"` |

Archetype and gimmick strings belong on **candidates** when compatible dressing narrowings cluster around a causal anchor --- not on individual enrich rows.

**POV rule:** The Coyote-perspective **`narrowing` POV rule** applies to **causal tropes only** (`Contraption`, `Bait`, `Misdirection`, `Disadvantage`, `Finishing Move`). Scene Dressing narrowings describe **what the prop signals visually or thematically**, not what it does for or to either character.

**Affordances:** Omit **`environmentAffordances`** and **`affordancesProvided`** on Scene Dressing trope entries (non-functional trope; no completion-by-environment beat).

## Prospective enum families (do not enforce yet)

Candidate families for later tightening:

- implementation_form (device, bait, terrain_hazard, payload_delivery, condition_effect)
- activation_mode (pre_staged, remote_triggered, proximity_triggered, timed, contact)
- target_scope (coyote_self, road_runner, route_segment, area)
- certainty_axis (explicit_terminal, setup_only, bridge_link)

These are design candidates only. Do not make wire-format changes that require them until explicitly approved in a task plan.
