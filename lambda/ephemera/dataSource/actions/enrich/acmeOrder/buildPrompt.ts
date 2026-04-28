/**
 * Acme order enrich: parse a **single** Acme-order verb-phrase (one action: order from Acme). Multi-command inputs are
 * filtered upstream by `discriminateIntent` as `MultipleCommands` and do not run this enrich step. Validates
 * catalog rules per line item, normalized titles, affinities, and **`stableKey`** proposals. Coyote-wide
 * **`occupiedStableKeys`** embedding --- see **`LLM-first`** in [`../AGENT.md`](../AGENT.md).
 */

import type { ParseAcmeOrderEnrichPromptParts } from '../../../../generateExample/invokeBedrockAcmeOrderEnrich'

export type BuildParseAcmeOrderEnrichPromptOptions = {
    /** Union of **`stableKey`** values already used on staged objects across Coyote game rooms (must not invent collisions when avoidable). */
    occupiedStableKeys?: readonly string[];
};

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

    const invariantPrefix = `You validate and enrich **Acme mail-order** requests for a Coyote
vs. Road Runner contraption game. Player requests are expected to name things they want Acme
to deliver.

You will complete **two steps with different rules** — do not treat them as the same content in
two formats. Step 1 is **classification and concise rationale only** (no catalog JSON).
Step 2 is **the machine-readable Acme record** (affinities, normalized naming, and tone).

Produce **two parts** in order:

1. **Classify order type (Chain-of-reason markdown):** Walk each
**distinct product / line item** you extracted (see below). Use **one section or bullet block
per item**. For **every** item, reason **in the order below** (same classify step). That order
matters: corrections can move nonsense into a valid gloss; cartoon physics can move
**real-world impossible** into **in-genre** before you pick the primary bucket.

   **First — Correctable user error:** Check whether the surface text is plausibly a typo,
   speech-to-text glitch, or wrong-word slip against Coyote / Acme vocabulary
   (**potable**→**portable**, etc.). If so, state the **intended gloss** and use
   **only that gloss** for the rest of the reasoning on this line. If no correction applies,
   say so briefly. **Do not** label **Not a thing** when a reasonable correction yields
   a clear deliverable.

   **Second — Cartoon physics modifier:** Given the **effective wording** (after any correction),
   set **Cartoon physics: yes** when the deliverable **defies real-world physics or manufacturing**
   but is **normal Coyote vs. Road Runner stock** (flying carpets, portable holes,
   delayed-fall kits, etc.). Otherwise **Cartoon physics: no**. Use this **after** corrections so
   an impossible-looking string is re-judged after fixing the words. This is a **modifier**
   stacked on the primary category — not a substitute for **Phenomenon** / **Diffuse** /
   **Self-contained**.

   **Third — Primary category (exactly one):** Pick **one** bucket for the line.
   **Do not** reject for insufficient silliness or gag quality — genre vibe is **not**
   eligibility here. **Do not** shoehorn into **Not tangible** for vibe reasons.

   - **Not a thing:** The effective wording still does not parse to a noun phrase you can treat as a requested deliverable, or it remains gibberish / not a product after correction.
   - **Not tangible:** It parses as a noun, but names something abstract (**justice**, **hope**) — not a physical deliverable even with packaging.
   - **Too large:** Only when the ask names **scale that breaks the cartoon stage as one
     deliverable** — for example **the Galilean moons**, **the Moon**, **North America**,
     **the jet stream** as a boxed SKU. **Do not** use real-world freight intuition:
     tower cranes, diesel locomotives, moon rockets, grand pianos, and similar
     **Chuck Jones oversized props** are **Self-contained** (or **Diffuse** / **Phenomenon**
     when they fit), **not** **Too large**. **Cartoon physics** can stack here
     (cosmic gag, still rejected for scale).
   - **Phenomenon:** Concrete, but an ongoing process or event
     (laser beam, earthquake, lightning storm). Stay **brief**: state that label,
     then list **two** plausible Acme gadgets or deliveries that could **produce**
     that phenomenon.
   - **Diffuse:** Tangible, but not one self-contained unit
     (hydrogen gas, flock of crows, **cloud of mosquitos**, waterfall). Stay **brief**:
     state that label, then list **two** plausible **packages or generators**.
   - **Self-contained:** A single ship-ready article (crate, coil, costume, bottle, beehive).
     **Ordinary objecthood is not required** when **Cartoon physics: yes** —
     a flying carpet is still **Self-contained** (one SKU), not **Not a thing**.

   In your markdown, show the **three layers** briefly: correction (if any),
   **Cartoon physics** yes/no, then primary category. For **Not a thing**, **Not tangible**,
   or **Too large**, state only those facts plus modifiers — no packaging spin.
   For **Phenomenon** and **Diffuse**, record the **two** alternatives for Step 2.
   **Primary** **Not a thing** / **Not tangible** / **Too large** → **\`valid\`: false** in JSON;
   **Phenomenon**, **Diffuse**, **Self-contained** → **\`valid\`: true**.

2. **Enhance (JSON final):** After Step 1, output **one** trailing fenced code block with
language tag **json**. Inside the fence put **only** the root JSON object (**lines**,
optional **confidence**) — nothing else inside the fence. No prose after that closing fence.
This step applies Acme catalog normalization, canonical **\`tropeAffinities\`**, legacy
compatibility placeholders (**\`affinities\`** / **\`affinitiesFailed\`**), per-line
**stable reference keys** (**\`stableKey\`**), and light Coyote-vs.-Road-Runner presentation —
that cartoon-contraption flavor belongs **here**, not in Step 1's eligibility decisions.

The **Coyote-wide keys already in use** list appears **after** these instructions (before the player command). The **full player command** appears at the end of this prompt.

## Segment line items

From that command, extract **one entry in \`lines[]\` per distinct product / line item** within a
**single** Acme order line. Multi-command phrasing (two or more actions) is classified **before**
this step; you only segment **one** order into product lines. Split on commas, **and**, or
**also** to separate product names. Do not treat a leading order verb as a line item: ignore
**order**, **get**, **send**, and **mail order** at the start.
Example: **order glue and springs** → exactly two lines (**glue**, **springs**).
Preserve **speaker intent** — do not drop items.

## Catalog validation per line

Each **\`lines\`** entry must include **\`valid\`**: boolean, aligned with Step 1.

- **\`valid\`: false** (only for **Not a thing**, **Not tangible**, **Too large**) — include
  **\`errorType\`**: exactly one of **\`Not a thing\`**, **\`Not tangible\`**, **\`Too large\`**.
  Use **\`affinities\`**: []. **Do not** include **\`stableKey\`** on invalid lines.
- **\`valid\`: true** when Step 1 **primary** is **Phenomenon**, **Diffuse**, or
  **Self-contained** — normalized Acme catalog **\`name\`**, **\`stableKey\`** (see below),
  canonical **\`tropeAffinities\`** entries, and temporary compatibility placeholders
  **\`affinities\`**/**\`affinitiesFailed\`**. Choose **\`name\`** so shipped goods reflect
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

## Trope affinities must honor the player ask

For **\`valid\`: true** lines, derive **\`tropeAffinities\`** from the **effective order** —
the Step 1 **intended gloss** after any **Correctable user error**, not from a typo surface
string. If the fulfillment is a packaged variant (pressurized cylinder for a gas cloud,
mesh crate for insects), **do not** boost fit quality for hazards or uses implied only by the
vessel unless that **effective** wording supports it.

## Tone and catalog titles (\`valid\`: true)

Write **\`name\`** and implied roles in **cartoon physics / contraption** language (this is where genre voice lives).

- When Step 1 used **Cartoon physics: yes**, title the stock with **in-setting plausibility** (what Acme puts on the crate), not a skeptical real-world disclaimer.
- Prefer neutral physical words: gadget, hazard, launcher, coil, fuse, lure, obstacle.
- Normalize sloppy wording into polished **Acme-style product titles**.
- For phenomena, diffuse objects, or hazardous substances or creatures, phrase the **shippable package or generator**, not loose reality (crates, cylinders, reinforced containers).

Example **valid** line entry (inside **\`lines\`**):

{
  "valid": true,
  "name": "Beehive",
  "stableKey": "beehive",
  "affinities": [
    { "role": "influence-road-runner", "aptness": 0.7 },
    { "role": "terminal", "aptness": 0.5 }
  ]
}

Example **invalid** line entry:

{
  "valid": false,
  "name": "Justice",
  "errorType": "Not tangible",
  "affinities": []
}

## Canonical trope fields (\`tropeAffinities\`) for **\`valid\`: true**

Emit **1-3** trope-fit entries per deliverable line. Each entry must be:
- **\`trope\`**: exactly one of **\`Contraption\`**, **\`Distraction\`**, **\`Disadvantage\`**, **\`Finishing Move\`**
- **\`aptness\`**: exactly one of **\`High\`**, **\`Good\`**, **\`Poor\`**
- **\`narrowing\`**: concise free text for the specific use (no enum codes yet)

If you cannot justify trope fits for a valid line, set **\`tropeAffinitiesFailed\`**: true and **\`tropeAffinities\`**: [].

### Flat modification tags

Use these exact role tags with **\`aptness\`** only:

- **\`influence-road-runner\`**: impacts the Road Runner behavior or path.
- **\`alter-road-runner\`**: physically alters, restrains, or directly affects the Road Runner.
- **\`coyote-equipment\`**: equipment the Coyote uses or wears.
- **\`coyote-enhancement\`**: boosts Coyote capability or state.
- **\`setting-addition\`**: adds terrain or environmental setup.
- **\`connect-props\`**: links staged props into one mechanism.
- **\`enhance-prop\`**: modifies or improves an existing staged prop.

Do not emit legacy tuple fields like **\`target\`** or **\`mode\`**.

### Generative roles

**prep** and **creation** use **\`aptness\`** only.

- **prep**: before-beat setup, assembly, rigging, digging, or scene preparation.
- **creation**: in-beat generative or ephemeral effects produced during execution.
- Example (**prep**): dig a pit, rig a rope, or assemble launch hardware before execution.
- Example (**creation**): a Tesla coil creating lightning arcs during the beat.

### Structural roles

**terminal**, **trigger**, **delivery**, **autonomous_agent** — include **\`aptness\`** only.

## Legacy compatibility placeholders (temporary)

For every **\`valid\`: true** line during this transition slice, emit:
- **\`affinities\`**: []
- **\`affinitiesFailed\`**: true

Do not emit legacy role tuples in **\`affinities\`** for valid lines in this slice.

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
      "name": "<string>",
      "stableKey": "<string>",
      "tropeAffinities": [ { "trope": "Contraption", "aptness": "Good", "narrowing": "launch platform" } ],
      "affinities": [],
      "affinitiesFailed": true
    },
    { "valid": false, "name": "<string>", "errorType": "Not a thing", "affinities": [] }
  ],
  "confidence": <optional number 0..1>
}
\`\`\`
`

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
