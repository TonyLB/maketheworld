/**
 * Acme order enrich: validate and enrich product spans for a **single** Acme-order action. Multi-command inputs are
 * filtered upstream by `discriminateIntent` as `MultipleCommands` and do not run this step.
 *
 * **Segmentation contract:** When **`intentRawOrders`** is non-empty, those strings (extracted from
 * the Parse skeleton's `objectSpan` tokens by `plan/matchAcmeOrderFamily.ts`) are **authoritative** - emit one Step 1 row and one
 * `lines[]` entry per span; do not re-segment from the full player command. Intent and enrich share the
 * same conservative-merge rule upstream, so this avoids a second-guess pass that could disagree.
 * When **`intentRawOrders`** is omitted or empty (e.g. affinities harness), the prompt falls back to
 * segmenting from the full command only.
 *
 * **Deferred parallelization:** Each authoritative span is an independent unit of work; a future refactor
 * could run one `invokeBedrockAcmeOrderEnrich` per span concurrently, merge `lines[]`, and pass
 * `occupiedStableKeys` into every call. Not implemented in this module yet.
 *
 * Coyote-wide **`occupiedStableKeys`** embedding - see **`LLM-first`** in [`../AGENT.md`](../AGENT.md).
 */

import type { ParseAcmeOrderEnrichPromptParts } from '../../../../generateExample/invokeBedrockAcmeOrderEnrich'
import {
    joinFewShotBlocks,
    resolveIncludeIconicFewShots,
    type IncludeIconicFewShotsOptions,
} from '../../../coyotePromptFewShot'

export type BuildParseAcmeOrderEnrichPromptOptions = {
    /** Union of **`stableKey`** values already used on staged objects across Coyote game rooms (must not invent collisions when avoidable). */
    occupiedStableKeys?: readonly string[];
    /** When non-empty: authoritative product spans from intent classification (one `lines[]` row per span). */
    intentRawOrders?: readonly string[];
    /** Deprecated compatibility flag; prompt remains compact regardless of value. */
    debugRationale?: boolean;
} & IncludeIconicFewShotsOptions;

const INTRO_THROUGH_COYOTE_POV = `You validate and enrich **Acme mail-order** requests for a Coyote
vs. Road Runner contraption game. Player requests are expected to name things they want Acme
to deliver.

Your reply has **two required parts in fixed order**:
1) compact Markdown rationale lines (classification only; no catalog JSON),
2) one trailing fenced **json** handoff block (machine-readable Acme record).

**Causal** trope assignments, their narrowings, and plan reasoning in this prompt are evaluated from the
**Coyote's perspective exclusively**. The Coyote is the sole planner. The Road Runner is the
target in this model. When assigning causal tropes and writing their narrowings, always ask: "What does
this item do for the Coyote or against the Road Runner?" Never frame an item's role in terms
of what it does for the Road Runner.
**Scene Dressing** narrowings name **aesthetic or material categories** (for example racing gear,
protective equipment) --- not Coyote-vs-Road-Runner mechanics.

`

const COMPACT_STEP1_INSTRUCTIONS = `1. **Compact rationale lines:** For each **distinct product / line item** you work on in this order (see **## Segment line items**), emit **exactly one** pipe-separated row with these fields in order:

surface text | gloss: corrected phrase or (none) | physics: yes or no | primary: bucket | finishing-mechanisms: mechanism1, mechanism2 or none | packaging-alts: alt1; alt2 or n/a

**One product = one row:** The **surface text** field is the **full** product phrase for that item (e.g. **rocket skates** is **one** surface spanning both words). **Do not** emit a second row for a tail noun (**skates**) peeled off a compound name. Put **each** product row on its **own** line in Step 1 (newline between rows); **never** glue two products into one pipe row.

Walk **in order** for every item: **(1)** correction gloss **(2)** cartoon physics **(3)** primary bucket **(4)** finishing mechanisms **(5)** packaging alternatives.
Output compact rationale rows only for this section; avoid decorative Markdown headings (for example, no **##** or **###** titles).

- **gloss:** After **correctable** typo/malaprop/STT fix (**potable** to **portable**, etc.), the intended noun phrase; **(none)** if no fix. **Do not** choose **Not a thing** if a reasonable correction yields a deliverable.
- **physics:** **yes** if the deliverable defies real-world physics/manufacturing but is normal Coyote vs. Road Runner stock; **no** otherwise. Apply **after** gloss. **Modifier** on the primary bucket only — not a substitute for Phenomenon / Diffuse / Self-contained.
- **primary (exactly one):** **Not a thing** | **Not tangible** | **Too large** | **Celebrity cameo** | **Phenomenon** | **Diffuse** | **Self-contained**. **Eligibility is parse and category**, not whether the item feels on-theme for a gag. **Do not** reject for weak slapstick, insufficient whimsy, or "the Coyote would not plan with this" — that is **never** a **Not a thing** test.
- **finishing-mechanisms:** one or more of **impact**, **explosion**, **area-hazard**, **projectile**, **collision** (comma-separated, no duplicates) when this item itself delivers that harm mechanism directly to or at the Road Runner, without requiring a downstream item to do the actual work; emit **none** otherwise. Use a **single best mechanism** by default; combine mechanisms only when dual behavior is encoded in the ordered item's intent (for example, wording that explicitly combines blast + lingering cloud). **Trap closure**, **immobilization**, and **restraint** are not finishing mechanisms (route those as **Disadvantage**). Rigs/infrastructure-only lines (pulley rig, launcher frame, drop platform) emit **none**. Invalid primaries emit **none**. If payoff depends on an environment object to complete doom (painted tunnel -> rock wall collision, portable hole -> long fall), keep **finishing-mechanisms: none** on the item and represent that via **\`environmentAffordances\`** with **roles** including **Finishing Move**.
- **packaging-alts:** For **Phenomenon** or **Diffuse**, two short generator/package labels separated by **; ** (feeds Step 2 naming). Otherwise **n/a**.

**Primary bucket checklist (correction -> physics -> primary):**
Treat these seven checks as a decision waterfall for **each product span or line item** in this order, not as seven output slots. Do **not** invent extra products to populate buckets.
**Check 1 (exit -> Not a thing):** If, after any correction, the line still does **not** parse as a **product noun phrase** the player is asking to receive, or remains gibberish / not a named thing at all, emit **Not a thing** and **Stop**. **Never** use **Not a thing** for a plain physical noun the player clearly ordered (**paint**, **glue**, **rope**, **anvil**, **nails**) — those parse fine; continue to later checks and place in **Self-contained** / **Diffuse** / **Phenomenon** / **Too large** as appropriate.
**Check 2 (exit -> Not tangible):** If check 1 did not exit and the phrase parses as a noun but names something abstract (**justice**, **hope**) rather than a physical deliverable (even with packaging), emit **Not tangible** and **Stop**. **Never** apply **Not tangible** merely because scale is exaggerated; if the object is physically real, continue to the scale check.
**Check 3 (exit -> Too large):** If checks 1-2 did not exit and the requested thing is **cosmic / stage-breaking scale** as one SKU (Moon, continents, jet stream boxed), emit **Too large** and **Stop**. **Never** freight intuition: cranes, locomotives, grand pianos, moon rockets, Chuck Jones mega-props => continue to later checks and classify as **Self-contained** / **Diffuse** / **Phenomenon**, not **Too large**.
**Check 4 (exit -> Celebrity cameo):** If checks 1-3 did not exit and the line asks Acme to deliver, summon, or arrange a specific person / famous individual as the product itself (cameo, celebrity guest, named real-world figure), emit **Celebrity cameo** and **Stop**.
**Check 5 (exit -> Phenomenon):** If checks 1-4 did not exit and the thing is an ongoing process/event (avalanche, storm, explosion cloud, lightning), emit **Phenomenon**, provide **packaging-alts** (two ways Acme ships or triggers it), and **Stop**. **Never** use **Phenomenon** for collections of separable physical units (swarm, powder, liquid, granules, insects, particles); those are **Diffuse**.
**Check 6 (exit -> Diffuse):** If checks 1-5 did not exit and the thing is tangible but not one unit (separable physical units such as swarm, powder, liquid, granules), emit **Diffuse**, provide **packaging-alts** (two package/generator labels), and **Stop**. **Never** use **Diffuse** for ongoing processes/events; those are **Phenomenon**. Use nature-of-thing, not scale.
**Fallthrough -> Self-contained:** If none of checks 1-6 exited, emit **Self-contained**. This is one SKU shipped as an article, including mundane hardware and supplies (**paint**, **glue**, **rope**, **springs**) when the player names them as the product. **Cartoon physics: yes** still counts (**flying carpet**).

**valid:** **Not a thing** / **Not tangible** / **Too large** / **Celebrity cameo** => **valid**: false in JSON. **Phenomenon** / **Diffuse** / **Self-contained** => **valid**: true.

**Finishing Move anchor (Step 1):** For **valid** lines, any non-**none** **finishing-mechanisms** value is a strong signal to lead JSON **\`tropeAffinities\`** with **Finishing Move** at **High** or **Good** aptness. Point payloads (anvil, harpoon) and area payloads (bees, gas, explosives) usually lead **Finishing Move**. Launcher, pulley, drop platform = **Contraption**, not the payload. Ask: *Is this the last thing the Road Runner experiences?* If yes, lead JSON with **Finishing Move**.`

const AFTER_STEP1_INSTRUCTIONS = `2. **JSON handoff:** After rationale rows, output **one** trailing fenced code block with
language tag **json**. Inside the fence put **only** the root JSON object (**lines**,
optional **confidence**) — nothing else inside the fence. No prose after that closing fence.
This step applies Acme catalog normalization, canonical **\`tropeAffinities\`**, per-line
**stable reference keys** (**\`stableKey\`**), and light Coyote-vs.-Road-Runner presentation —
that cartoon-contraption flavor belongs **here**, not in Step 1's eligibility decisions.
For **\`valid\`: true** lines, the machine record is **\`name\`**, **\`stableKey\`**, **\`tropeAffinities\`** (and, when needed, **\`tropeAffinitiesFailed\`**), plus **\`defaultSituation\`** — one trope-scoring array, not a second parallel array.

**\`defaultSituation\`** (**\`valid\`: true** lines only): one short **\`description\`** (one or two plain sentences describing the object as a player would first see it — straight physical description, not cartoon-trope narrowing language) and, optionally, **\`displayName\`** (a short player-facing name, defaults to **\`name\`** if omitted) and **\`summary\`** (a one-line summary shorter than **\`description\`**). This is flavor text for the object's own look/examine text, independent of the Step 1/2 catalog and trope classification above. If you cannot produce grounded prose for a line, omit **\`defaultSituation\`** entirely and set **\`defaultSituationFailed\`**: true rather than inventing empty or placeholder text.

The **Coyote-wide keys already in use** list appears **after** these instructions. When upstream
product spans are included, they appear before the **full player command** at the end of this prompt.

## Segment line items

**When \`## Product spans to validate\` appears later in this prompt** (non-empty bullet list):
those strings are **authoritative** segmentation from intent classification (same conservative-merge
rule you would use here). Emit **exactly one** Step 1 rationale row and **one** \`lines[]\` entry per
listed span, in list order. **Do not** re-segment, merge, or split spans from the full player command.
If a span incorrectly begins with **order**, **get**, **send**, or **mail order**, strip that prefix;
otherwise treat each span as the unit of work. Do **not** drop spans.

**When that section is absent** (no upstream span list): multi-command phrasing is classified **before**
this step. Segment from the **full player command** at the end of this prompt: extract **one** \`lines[]\`
entry per distinct product within a **single** Acme order. Split on commas, **and**, or **also** to
separate product names. Do not treat a leading order verb as a line item: ignore **order**, **get**,
**send**, and **mail order** at the start. A **single** deliverable is often **several words** (e.g.
**rocket skates**, **giant rubber band**). **Do not** split on spaces inside one product. Example:
**order rocket skates** -> one line item (**rocket skates**). Example: **order glue and springs** -> two
lines (**glue**, **springs**). Preserve **speaker intent**. If the command is one product phrase with
no explicit separators, extract exactly one line item. Do **not** fabricate a kit/bundle list.

**Parallelization (deferred, not implemented):** With authoritative spans, each span could be validated
in a separate Bedrock call and results merged at the orchestration layer; \`occupiedStableKeys\` would
still be supplied to every call to reduce \`stableKey\` collisions.

## Catalog validation per line

Each **\`lines\`** entry must include **\`valid\`**: boolean, aligned with Step 1.

- **\`valid\`: false** (only for **Not a thing**, **Not tangible**, **Too large**, **Celebrity cameo**) — include
  **\`errorType\`**: exactly one of **\`Not a thing\`**, **\`Not tangible\`**, **\`Too large\`**, **\`Celebrity cameo\`**.
  **Do not** include **\`stableKey\`** on invalid lines.
- **\`valid\`: true** when Step 1 **primary** is **Phenomenon**, **Diffuse**, or
  **Self-contained** — normalized Acme catalog **\`name\`**, **\`stableKey\`** (see below),
  and canonical **\`tropeAffinities\`** entries. Choose **\`name\`** so shipped goods reflect
  Step 1 packaging for Phenomenon/Diffuse. When Step 1 had **Cartoon physics: yes**,
  title the SKU with straight-faced Acme packaging — the impossible behavior **is** the product.

## Stable reference key (**\`stableKey\`**, **\`valid\`: true** only)

Emit **\`stableKey\`**: a single **slug-shaped** string per deliverable line:
**ASCII lowercase** letters **a-z**, digits **0-9**, and **hyphens** only
(no spaces or underscores). Prefer **semantic** hyphenated labels
(**\`rocket-high-powered\`**) over opaque numeric suffixes when you can still avoid collisions.
**Do not** use keys that begin with **\`constructed-\`** (reserved). Avoid every key listed under
**Coyote-wide keys already in use** below **when you can** pick a distinct readable slug; if the
list is empty, still choose stable, unique-looking keys within this order.

## Trope fits must honor the player ask

For **\`valid\`: true** lines, derive **\`tropeAffinities\`** from the **effective order** —
the Step 1 **intended gloss** after any **Correctable user error**, not from a typo surface
string. If the fulfillment is a packaged variant (pressurized cylinder for a gas cloud,
mesh crate for insects), **do not** boost fit quality for hazards or uses implied only by the
vessel unless that **effective** wording supports it.
For Step 1 lines classified as **Phenomenon**, derive trope fits from what the phenomenon does
(its Road Runner/environment effect), not from the starter kit or generator form factor.
Treat the generator as vessel and the phenomenon as the effective order.
Example: "pocket avalanche trigger" produces an avalanche; score tropes for the avalanche
(cascading area payload, usually **Finishing Move** High/Good), not for the trigger device itself.

## Tone and catalog titles (\`valid\`: true)

Write **\`name\`** and implied use-cases in **cartoon physics / contraption** language (this is where genre voice lives).

- When Step 1 used **Cartoon physics: yes**, title the stock with **in-setting plausibility** (what Acme puts on the crate), not a skeptical real-world disclaimer.
- Prefer neutral physical words: gadget, hazard, launcher, coil, fuse, lure, obstacle.
- Normalize sloppy wording into polished **Acme-style product titles**.
- For phenomena, diffuse objects, or hazardous substances or creatures, phrase the **shippable package or generator**, not loose reality (crates, cylinders, reinforced containers).

See **Few-shot examples** below for valid and invalid **\`lines[]\`** entry shape.

## Canonical trope fields (\`tropeAffinities\`) for **\`valid\`: true**

Emit **1-3** trope-fit entries per deliverable line. Each entry must be:
- **\`trope\`**: exactly one of **\`Scene Dressing\`**, **\`Contraption\`**, **\`Bait\`**, **\`Misdirection\`**, **\`Disadvantage\`**, **\`Finishing Move\`**
- **\`aptness\`**: exactly one of **\`High\`**, **\`Good\`**, **\`Poor\`**
- **\`narrowing\`**: concise free text for the specific use (no enum codes yet)
- optional **\`environmentAffordances\`**: **\`{ object, roles }[]\`** scene affordances (see closed-world rule below)
- optional **\`affordancesProvided\`**: **\`{ object, intended?, roles }[]\`** explicit affordances this item contributes (see rule below)
- **\`trope\`** is an allowlist field: emit only **\`Scene Dressing\`**, **\`Contraption\`**, **\`Bait\`**, **\`Misdirection\`**, **\`Disadvantage\`**, or **\`Finishing Move\`**.

**Scene Dressing** (narrative association): this item completes a visual or thematic scene without contributing a causal mechanism. Narrowing names the aesthetic or material category: e.g. **\`"racing gear"\`**, **\`"protective equipment"\`**, **\`"scientific apparatus"\`**, **\`"adventurous clothing"\`**.

**\`narrowing\` POV rule (causal tropes only):** for **\`Contraption\`**, **\`Bait\`**, **\`Misdirection\`**, **\`Disadvantage\`**, and **\`Finishing Move\`**, write each narrowing from the **Coyote's planning perspective**:
describe what the item does for the Coyote or to the Road Runner.
Correct examples: "enhance Coyote pursuit speed", "immobilize Road Runner on road surface",
"lure Road Runner into blast zone".
Incorrect examples: "enhance mobility to evade pursuit", "escape from Coyote", "avoid the trap".
If a draft narrowing describes Road Runner goals/capabilities, reverse perspective before emitting.

**\`environmentAffordances\` rule (optional, per trope entry):**
- This field captures environment-dependent completion requirements around a trope beat, not intrinsic item behavior.
- Emit structured objects only:
  **\`environmentAffordances\`: [ { "object": "<object>", "roles": ["<trope>", "..."] } ]**
- **\`object\`** allowlist (closed world, exact tokens): **\`boulder\`**, **\`cactus\`**, **\`tumbleweed\`**, **\`rock-wall\`**, **\`long-fall\`**.
- **\`roles\`** allowlist (exact trope names): **\`Contraption\`**, **\`Bait\`**, **\`Misdirection\`**, **\`Disadvantage\`**, **\`Finishing Move\`**.
- On **\`Scene Dressing\`** trope entries, **omit** **\`environmentAffordances\`** (non-functional trope).
- For each entry, include one object and **1-2** roles that object can play for this trope beat.
- If no meaningful environment dependency is needed, **omit** **\`environmentAffordances\`** (preferred) rather than emitting **\`[]\`**.
- **Finishing-move exclusivity:** if item **finishing-mechanisms** is non-**none**, do **not** also claim **\`Finishing Move\`** in **\`environmentAffordances.roles\`** for that same beat.
- Use **\`environmentAffordances.roles\`** including **\`Finishing Move\`** when an environment object completes doom while the item itself remains non-terminal.
- Canonical examples:
  - paint / fake tunnel => **\`{ "object": "rock-wall", "roles": ["Finishing Move"] }\`**
  - portable hole => **\`{ "object": "long-fall", "roles": ["Finishing Move"] }\`**
  - giant rubber band => **\`{ "object": "cactus", "roles": ["Contraption"] }\`**, **\`{ "object": "boulder", "roles": ["Finishing Move", "Contraption"] }\`**
  - birdseed trail (optional) => **\`{ "object": "boulder", "roles": ["Finishing Move"] }\`** when lure sets up a drop point.

**\`affordancesProvided\` rule (optional, per trope entry):**
- This field captures affordances that the ordered item directly contributes for downstream plan assembly.
- Emit structured objects only:
  **\`affordancesProvided\`: [ { "object": "<free text object>", "intended": true, "roles": ["<trope>", "..."] } ]**
- **\`object\`** is free text (non-empty string), not a closed-world token list.
- **\`intended\`** is optional; when present it must be literal **\`true\`**.
- **\`roles\`** allowlist (exact trope names): **\`Contraption\`**, **\`Bait\`**, **\`Misdirection\`**, **\`Disadvantage\`**, **\`Finishing Move\`**.
- On **\`Scene Dressing\`** trope entries, **omit** **\`affordancesProvided\`** (non-functional trope).
- For each entry, include one object and **1-2** roles.
- If no explicit provided affordance is needed, **omit** **\`affordancesProvided\`** (preferred) rather than emitting **\`[]\`**.
- **\`environmentAffordances\`** and **\`affordancesProvided\`** may coexist on the same causal trope entry when both signals are justified.

If you cannot justify trope fits for a valid line, set **\`tropeAffinitiesFailed\`**: true and **\`tropeAffinities\`**: [].

**Contraption payload exclusion:** Contraption is setup infrastructure or capability boost, not the
terminal payload itself. If removing the item removes the plan's terminal harm/capture effect, the item
is payload-first: prefer **Finishing Move** (or **Disadvantage** when it is persistent impairment) before
**Contraption**. Contraption applies to the rig or delivery mechanism around the payload.
Dual-use handling: when wording supports both readings, keep payload-first as the stronger fit
(typically **High**/**Good**), and include **Contraption** only as a weaker secondary fit
(typically **Poor**, sometimes **Good**) when the line explicitly supports setup use.
Examples: knockout gas canister = payload (Finishing Move area payload), pressurized release manifold = Contraption;
grand piano dropped on Road Runner = payload (Finishing Move point payload), pulley drop rig = Contraption;
grand piano used as seesaw counterweight = Contraption; if wording supports both uses, prefer
Finishing Move first and keep Contraption as secondary.

**\`Bait\`** (voluntary lure) **mechanism test (volition-dependent):** **Bait** is correct only
when the lure itself is the causal mechanism. The plan works because the Road Runner notices,
wants, and voluntarily moves toward or engages with the lure. If the item still works when
the Road Runner does not notice it, does not choose it, or does not cooperate, it is not
**Bait**.
Positive example: birdseed trail, novelty lure, or appetitive payload that the Road Runner
must see and choose to approach for the beat to work.
Negative example: lasso or net that captures on contact even if unseen. Alarming or
disorienting side effects do not make that **Bait**; route those as **Disadvantage** or
**Finishing Move**.

**\`Misdirection\`** (illusion / misread terrain) **mechanism test (knowledge / perception failure):**
**Misdirection** is correct when the plan works because the Road Runner **cannot accurately
see or steer** -- locomotion proceeds, but vision is obscured, optics are misleading, or
terrain is misread, so motion is steered into peril. The defining axis is **knowledge or
perception failure**, not raw ability impairment. Positive examples: painted tunnel on a
rock face, painted shortcut on a cliff, fake detour signage that **misrepresents real
terrain**, fog or smokescreen that hides a hazard already in the Road Runner's path.
Distinguish from neighboring tropes:
- **Misdirection vs \`Disadvantage\`:** an **oil slick** is **Disadvantage** when the plan
  assumes the Road Runner **stops or is mobility-trapped** by loss of friction; tag it
  **Misdirection** when the plan assumes **continued motion without adequate control**
  steers him into peril. Persistent ability impairment regardless of perception is always
  **Disadvantage**.
- **Misdirection vs \`Contraption\`:** the **painted illusion surface** itself (a tunnel
  painted on the rock face, a fake horizon line) is **Misdirection**. **Contraption** is
  reserved for the **setup machinery or capability** deployed for other purposes -- a
  fake-tunnel painting robot is **Contraption**; the painted illusion it produces is
  **Misdirection**.

A plan **may** include **both** **Bait** and **Misdirection**; when both apply, score them
separately on the same item rather than collapsing to one fit.

Honey-trap dual-fit rule: desirable lure objects can fit both **Bait** and **Disadvantage**
when both mechanisms are explicitly present. Use **Bait** for the voluntary
approach/engagement beat, and use **Disadvantage** for the persistent impairment caused by
consuming, touching, or otherwise engaging with the same lure.

**Disadvantage positive anchor:** Disadvantage items impose a persistent condition on the
Road Runner independent of his awareness or choices. Canonical Disadvantage fits include
surface hazards (glue, marbles, mobility-trapping oil slick), physical restraints (rope,
net, adhesive trap), and sustained impairments (lingering knockout gas cloud, darkness,
disorientation field).
Spiking something the Road Runner wants (for example, adding ball-bearings or knockout pills
to a lure plate) is still **Disadvantage** for the spiked payload because the imposed
impairment persists after engagement.
When the core use is ongoing mobility/option reduction, treat Disadvantage as a leading fit with **High** or **Good** aptness (not hedged
downward).

## Failure and confidence

- Optional root **\`confidence\`**: **[0, 1]** for this pass.
- If **\`valid\`: true** but you cannot justify canonical trope fits, set
  **\`tropeAffinitiesFailed\`**: true and **\`tropeAffinities\`**: [].
  You must still emit **\`stableKey\`** on that line.

## Enhance JSON shape (inside the **json** fence only)

\`\`\`json
{
  "lines": [
    {
      "valid": true,
      "name": "Anvil",
      "stableKey": "anvil",
      "tropeAffinities": [
        { "trope": "Finishing Move", "aptness": "High", "narrowing": "drop payload onto Road Runner" }
      ],
      "defaultSituation": {
        "description": "A squat cast-iron anvil, chipped along one edge, heavy enough to leave a dent where it lands."
      }
    },
    {
      "valid": true,
      "name": "Catapult",
      "stableKey": "catapult",
      "tropeAffinities": [
        {
          "trope": "Contraption",
          "aptness": "Good",
          "narrowing": "launch platform for payload delivery",
          "environmentAffordances": [
            { "object": "boulder", "roles": ["Finishing Move", "Contraption"] }
          ],
          "affordancesProvided": [
            { "object": "long rope for setting off", "intended": true, "roles": ["Contraption"] }
          ]
        }
      ]
    },
    { "valid": false, "name": "Justice", "errorType": "Not tangible" }
  ],
  "confidence": 0.9
}
\`\`\`
`

/** Core few-shot: JSON handoff shape; illustrative stableKeys only (not harness goldens). */
const ACME_ENRICH_FEW_SHOT_CORE = `## Few-shot examples (shape)

Example **valid** line entry (inside **\`lines\`**):

{
  "valid": true,
  "name": "Beehive",
  "stableKey": "beehive",
  "tropeAffinities": [
    { "trope": "Bait", "aptness": "Good", "narrowing": "lure trail to swarm zone" },
    { "trope": "Finishing Move", "aptness": "Poor", "narrowing": "swarm release payoff" }
  ]
}

Example **invalid** line entries:

{
  "valid": false,
  "name": "Justice",
  "errorType": "Not tangible"
}

{
  "valid": false,
  "name": "Justice Sonia Sotomayor",
  "errorType": "Celebrity cameo"
}

Multi-line order (**two** \`lines[]\` rows --- illustrative stableKeys):

\`\`\`json
{
  "lines": [
    {
      "valid": true,
      "name": "Industrial Adhesive",
      "stableKey": "workshop-glue",
      "tropeAffinities": [
        { "trope": "Disadvantage", "aptness": "High", "narrowing": "immobilize Road Runner on road surface" },
        { "trope": "Contraption", "aptness": "Good", "narrowing": "adhesive rig component" }
      ]
    },
    {
      "valid": true,
      "name": "Assorted Springs",
      "stableKey": "workshop-springs",
      "tropeAffinities": [
        { "trope": "Contraption", "aptness": "High", "narrowing": "mechanical tension rig for launch or rebound" }
      ]
    }
  ]
}
\`\`\`
`

// Mirrors clean-001-rocket-skates and borderline-001 hole-trap spread; keep in sync with acmeOrderAffinitiesHarnessPhrases / coyoteEngineTestFixtures.
const ACME_ENRICH_FEW_SHOT_ICONIC = `Iconic genre examples (**calibration** --- assign **stableKey** slugs for this order; do not copy these slugs when **Coyote-wide keys already in use** forbids collision):

Scene Dressing chase:
\`\`\`json
{
  "lines": [
    {
      "valid": true,
      "name": "Rocket Skates",
      "stableKey": "rocket-skates",
      "tropeAffinities": [
        { "trope": "Contraption", "aptness": "High", "narrowing": "enhance Coyote pursuit speed" }
      ]
    },
    {
      "valid": true,
      "name": "Protective Helmet",
      "stableKey": "helmet",
      "tropeAffinities": [
        { "trope": "Scene Dressing", "aptness": "Good", "narrowing": "protective equipment" }
      ]
    },
    {
      "valid": true,
      "name": "Racing Goggles",
      "stableKey": "goggles",
      "tropeAffinities": [
        { "trope": "Scene Dressing", "aptness": "Good", "narrowing": "racing gear" }
      ]
    }
  ]
}
\`\`\`

Portable-hole spread:
\`\`\`json
{
  "lines": [
    {
      "valid": true,
      "name": "Roller Skates",
      "stableKey": "roller-skates",
      "tropeAffinities": [
        { "trope": "Contraption", "aptness": "High", "narrowing": "mobility rig for setup and chase positioning" }
      ]
    },
    {
      "valid": true,
      "name": "Tunnel Paint Kit",
      "stableKey": "paint",
      "tropeAffinities": [
        { "trope": "Misdirection", "aptness": "High", "narrowing": "visual lure through fake passage cue", "environmentAffordances": [{ "object": "rock-wall", "roles": ["Finishing Move"] }] },
        { "trope": "Bait", "aptness": "Good", "narrowing": "draw Road Runner attention to painted route" }
      ]
    },
    {
      "valid": true,
      "name": "Portable Hole",
      "stableKey": "portable-hole",
      "tropeAffinities": [
        { "trope": "Misdirection", "aptness": "High", "narrowing": "persistent route hazard", "environmentAffordances": [{ "object": "long-fall", "roles": ["Finishing Move"] }] }
      ]
    },
    {
      "valid": true,
      "name": "Birdseed",
      "stableKey": "birdseed",
      "tropeAffinities": [
        { "trope": "Bait", "aptness": "High", "narrowing": "voluntary lure or bait trail" }
      ]
    }
  ]
}
\`\`\`
`

function formatOccupiedStableKeysBlock(keys: readonly string[]): string {
    const uniqueSorted = [...new Set(keys.map((k) => k.trim()).filter((k) => k.length > 0))].sort(
        (a, b) => a.localeCompare(b)
    )
    if (uniqueSorted.length === 0) {
        return '(none)'
    }
    return uniqueSorted.map((k) => `- ${k}`).join('\n')
}

function formatProductSpansToValidateBlock(spans: readonly string[]): string {
    const trimmed = spans.map((s) => s.trim()).filter((s) => s.length > 0)
    if (trimmed.length === 0) {
        return ''
    }
    const lines = trimmed.map((s) => `- ${s}`).join('\n')
    return `## Product spans to validate

The intent-discrimination step extracted these product noun phrase(s). They are **authoritative**:
emit one Step 1 row and one \`lines[]\` entry per span. Do not re-segment from the full player command.

${lines}

`
}

export function buildParseAcmeOrderEnrichPrompt(
    command: string,
    options?: BuildParseAcmeOrderEnrichPromptOptions
): ParseAcmeOrderEnrichPromptParts {
    const trimmed = command.trim()
    const commandBlock = trimmed === '' ? '(empty command)' : trimmed

    const fewShotBlock = joinFewShotBlocks(
        ACME_ENRICH_FEW_SHOT_CORE,
        ACME_ENRICH_FEW_SHOT_ICONIC,
        resolveIncludeIconicFewShots(options)
    )

    const invariantPrefix = `${INTRO_THROUGH_COYOTE_POV}

Produce **two required parts in order**:

${COMPACT_STEP1_INSTRUCTIONS}

${AFTER_STEP1_INSTRUCTIONS}

${fewShotBlock}`

    const occupied = options?.occupiedStableKeys ?? []
    const occupiedBlock = formatOccupiedStableKeysBlock(occupied)
    const productSpansBlock = formatProductSpansToValidateBlock(options?.intentRawOrders ?? [])

    const dynamicSuffix = `## Coyote-wide stable keys already in use

These **\`stableKey\`** values are already assigned to staged objects somewhere in the
Coyote play-space. Prefer **not** to reuse them; choose a distinct slug
**when semantics allow**.

${occupiedBlock}

${productSpansBlock}## Player command (full string)

${commandBlock}
`

    return { invariantPrefix, dynamicSuffix }
}
