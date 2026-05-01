/**
 * Acme order enrich: parse a **single** Acme-order verb-phrase (one action: order from Acme). Multi-command inputs are
 * filtered upstream by `discriminateIntent` as `MultipleCommands` and do not run this enrich step. Validates
 * catalog rules per line item, normalized titles, trope fits, and **`stableKey`** proposals. Coyote-wide
 * **`occupiedStableKeys`** embedding --- see **`LLM-first`** in [`../AGENT.md`](../AGENT.md).
 */

import type { ParseAcmeOrderEnrichPromptParts } from '../../../../generateExample/invokeBedrockAcmeOrderEnrich'

export type BuildParseAcmeOrderEnrichPromptOptions = {
    /** Union of **`stableKey`** values already used on staged objects across Coyote game rooms (must not invent collisions when avoidable). */
    occupiedStableKeys?: readonly string[];
    /** Deprecated compatibility flag; prompt remains compact regardless of value. */
    debugRationale?: boolean;
};

const INTRO_THROUGH_COYOTE_POV = `You validate and enrich **Acme mail-order** requests for a Coyote
vs. Road Runner contraption game. Player requests are expected to name things they want Acme
to deliver.

Your reply has **two required parts in fixed order**:
1) compact Markdown rationale lines (classification only; no catalog JSON),
2) one trailing fenced **json** handoff block (machine-readable Acme record).

All trope assignments, narrowings, and plan reasoning in this prompt are evaluated from the
**Coyote's perspective exclusively**. The Coyote is the sole planner. The Road Runner is the
target in this model. When assigning tropes and writing narrowings, always ask: "What does
this item do for the Coyote or against the Road Runner?" Never frame an item's role in terms
of what it does for the Road Runner.

`

const COMPACT_STEP1_INSTRUCTIONS = `1. **Compact rationale lines:** For each **distinct product / line item** you extract (see **Segment line items**), emit **exactly one** pipe-separated row with these fields in order:

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
1. **Not a thing** — **Only** when, after any correction, the line still does **not** parse to a **product noun phrase** the player is asking to receive, or it is still gibberish / not a named thing at all. **Never** use **Not a thing** for a plain physical noun the player clearly ordered (**paint**, **glue**, **rope**, **anvil**, **nails**) — those parse fine; put them in **Self-contained** / **Diffuse** / **Phenomenon** / **Too large** as appropriate.
2. **Not tangible** — Parses as a noun but names something abstract (**justice**, **hope**) — not a physical deliverable even with packaging.
3. **Too large** — **Cosmic / stage-breaking scale** as one SKU (Moon, continents, jet stream boxed). **Never** freight intuition: cranes, locomotives, grand pianos, moon rockets, Chuck Jones mega-props => **Self-contained** / **Diffuse** / **Phenomenon**, not **Too large**.
4. **Celebrity cameo** — The line asks Acme to deliver, summon, or arrange a specific person / famous individual as the product itself (cameo, celebrity guest, named real-world figure). This is not a catalog good.
5. **Phenomenon** — Ongoing process/event; **packaging-alts** required (two ways Acme ships or triggers it).
6. **Diffuse** — Tangible but not one unit; **packaging-alts** required.
7. **Self-contained** — One SKU shipped as an article; includes mundane hardware and supplies (**paint**, **glue**, **rope**, **springs**) when the player names them as the product. **Cartoon physics: yes** still counts (**flying carpet**).

**valid:** **Not a thing** / **Not tangible** / **Too large** / **Celebrity cameo** => **valid**: false in JSON. **Phenomenon** / **Diffuse** / **Self-contained** => **valid**: true.

**Finishing Move anchor (Step 1):** For **valid** lines, any non-**none** **finishing-mechanisms** value is a strong signal to lead JSON **\`tropeAffinities\`** with **Finishing Move** at **High** or **Good** aptness. Point payloads (anvil, harpoon) and area payloads (bees, gas, explosives) usually lead **Finishing Move**. Launcher, pulley, drop platform = **Contraption**, not the payload. Ask: *Is this the last thing the Road Runner experiences?* If yes, lead JSON with **Finishing Move**.`

const AFTER_STEP1_INSTRUCTIONS = `2. **JSON handoff:** After rationale rows, output **one** trailing fenced code block with
language tag **json**. Inside the fence put **only** the root JSON object (**lines**,
optional **confidence**) — nothing else inside the fence. No prose after that closing fence.
This step applies Acme catalog normalization, canonical **\`tropeAffinities\`**, per-line
**stable reference keys** (**\`stableKey\`**), and light Coyote-vs.-Road-Runner presentation —
that cartoon-contraption flavor belongs **here**, not in Step 1's eligibility decisions.
For **\`valid\`: true** lines, the machine record is **only** **\`name\`**, **\`stableKey\`**, **\`tropeAffinities\`**, and (when needed) **\`tropeAffinitiesFailed\`** — one trope-scoring array, not a second parallel array.

The **Coyote-wide keys already in use** list appears **after** these instructions (before the player command). The **full player command** appears at the end of this prompt.

## Segment line items

From that command, extract **one entry in \`lines[]\` per distinct product / line item** within a
**single** Acme order line. Multi-command phrasing (two or more actions) is classified **before**
this step; you only segment **one** order into product lines. Split on commas, **and**, or
**also** to separate product names. Do not treat a leading order verb as a line item: ignore
**order**, **get**, **send**, and **mail order** at the start.
A **single** deliverable is often **several words** (e.g. **rocket skates**, **giant rubber band**,
**a deluxe bag of birdseed**). **Do not** split on spaces inside one product; interior words are
**not** separate line items. Only split where the player used explicit separators (commas, **and**,
**also**). Example: **order rocket skates** → **one** line item (**rocket skates**), not two.
Example: **order glue and springs** → exactly two lines (**glue**, **springs**).
Preserve **speaker intent** — do not drop items.

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

Example **valid** line entry (inside **\`lines\`**):

{
  "valid": true,
  "name": "Beehive",
  "stableKey": "beehive",
  "tropeAffinities": [
    { "trope": "Distraction", "aptness": "Good", "narrowing": "lure trail payload" },
    { "trope": "Finishing Move", "aptness": "Poor", "narrowing": "swarm release payoff" }
  ]
}

Example **invalid** line entry:

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

## Canonical trope fields (\`tropeAffinities\`) for **\`valid\`: true**

Emit **1-3** trope-fit entries per deliverable line. Each entry must be:
- **\`trope\`**: exactly one of **\`Contraption\`**, **\`Distraction\`**, **\`Disadvantage\`**, **\`Finishing Move\`**
- **\`aptness\`**: exactly one of **\`High\`**, **\`Good\`**, **\`Poor\`**
- **\`narrowing\`**: concise free text for the specific use (no enum codes yet)
- optional **\`environmentAffordances\`**: **\`{ object, roles }[]\`** scene affordances (see closed-world rule below)
- optional **\`affordancesProvided\`**: **\`{ object, intended?, roles }[]\`** explicit affordances this item contributes (see rule below)
- **\`trope\`** is an allowlist field: emit only **\`Contraption\`**, **\`Distraction\`**, **\`Disadvantage\`**, or **\`Finishing Move\`**.

**\`narrowing\` POV rule:** write each narrowing from the **Coyote's planning perspective**:
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
- **\`roles\`** allowlist (exact trope names): **\`Contraption\`**, **\`Distraction\`**, **\`Disadvantage\`**, **\`Finishing Move\`**.
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
- **\`roles\`** allowlist (exact trope names): **\`Contraption\`**, **\`Distraction\`**, **\`Disadvantage\`**, **\`Finishing Move\`**.
- For each entry, include one object and **1-2** roles.
- If no explicit provided affordance is needed, **omit** **\`affordancesProvided\`** (preferred) rather than emitting **\`[]\`**.
- **\`environmentAffordances\`** and **\`affordancesProvided\`** may coexist on the same trope entry when both signals are justified.

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

**Distraction mechanism test (volition-dependent):** Distraction is correct only when the
distraction itself is the causal mechanism. The plan works because the Road Runner notices,
wants, and voluntarily moves toward or engages with the lure. If the item still works when
the Road Runner does not notice it, does not choose it, or does not cooperate, it is not
Distraction.
Positive example: birdseed trail, novelty lure, or fake detour sign where the Road Runner
must see and follow it for the beat to work.
Negative example: lasso or net that captures on contact even if unseen. Alarming or
disorienting side effects do not make that Distraction; route those as **Disadvantage** or
**Finishing Move**.
Honey-trap dual-fit rule: desirable lure objects can fit both **Distraction** and
**Disadvantage** when both mechanisms are explicitly present. Use **Distraction** for the
voluntary approach/engagement beat, and use **Disadvantage** for the persistent impairment
caused by consuming, touching, or otherwise engaging with the same lure.

**Disadvantage positive anchor:** Disadvantage items impose a persistent condition on the
Road Runner independent of his awareness or choices. Canonical Disadvantage fits include
surface hazards (glue, marbles, oil slick), physical restraints (rope, net, adhesive trap),
and sustained impairments (lingering knockout gas cloud, darkness, disorientation field).
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
      ]
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


function formatOccupiedStableKeysBlock(keys: readonly string[]): string {
    const uniqueSorted = [...new Set(keys.map((k) => k.trim()).filter((k) => k.length > 0))].sort(
        (a, b) => a.localeCompare(b)
    )
    if (uniqueSorted.length === 0) {
        return '(none)'
    }
    return uniqueSorted.map((k) => `- ${k}`).join('\n')
}

export function buildParseAcmeOrderEnrichPrompt(
    command: string,
    options?: BuildParseAcmeOrderEnrichPromptOptions
): ParseAcmeOrderEnrichPromptParts {
    const trimmed = command.trim()
    const commandBlock = trimmed === '' ? '(empty command)' : trimmed

    const invariantPrefix = `${INTRO_THROUGH_COYOTE_POV}

Produce **two required parts in order**:

${COMPACT_STEP1_INSTRUCTIONS}

${AFTER_STEP1_INSTRUCTIONS}`

    const occupied = options?.occupiedStableKeys ?? []
    const occupiedBlock = formatOccupiedStableKeysBlock(occupied)

    const dynamicSuffix = `## Coyote-wide stable keys already in use

These **\`stableKey\`** values are already assigned to staged objects somewhere in the
Coyote play-space. Prefer **not** to reuse them; choose a distinct slug
**when semantics allow**.

${occupiedBlock}

## Player command (full string)

${commandBlock}
`

    return { invariantPrefix, dynamicSuffix }
}
