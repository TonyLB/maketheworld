/**
 * Step B: Parse the full Acme-order command, validate catalog rules per line item, normalized titles, and affinities.
 */

import { COYOTE_AFFINITY_APTNESS_MIN } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { ParseAcmeOrderEnrichPromptParts } from '../../generateExample/invokeBedrockAcmeOrderEnrich'

export function buildParseAcmeOrderEnrichPrompt(command: string): ParseAcmeOrderEnrichPromptParts {
    const trimmed = command.trim()
    const commandBlock = trimmed === '' ? '(empty command)' : trimmed

    const floor = COYOTE_AFFINITY_APTNESS_MIN

    const invariantPrefix = `You validate and enrich **Acme mail-order** requests for a Coyote vs. Road Runner cartoon-contraption game. Players order props and gadgets; plans are **physical gags**, trebuchets, traps, and chase mechanics — not tabletop RPG sessions. Output structured JSON only.

The **full player command** appears at the end of this prompt.

## Segment line items

From that command, extract **one JSON object per distinct product / line item** (split on commas, **and**, **also**, multiple verbs, etc.). Preserve **speaker intent** — do not drop items.

## Catalog validation per line

Each **\`lines\`** entry must include **\`valid\`**: boolean.

- **\`valid\`: false** — include **\`errorType\`**: exactly one of **\`Not a thing\`** (not in catalog), **\`Not tangible\`** (abstract / not a ship-able good), **\`Too large\`** (unshipping scale). Use **\`affinities\`**: [].
- **\`valid\`: true** — normalized Acme catalog **\`name\`**, **\`affinities\`** role possibilities with **\`aptness\`** in **[0, 1]**.

## Tone (valid lines only)

Write **\`name\`** and implied roles in **cartoon physics / contraption** language.

- Prefer neutral physical words: gadget, hazard, launcher, coil, fuse, lure, obstacle.

## Catalog title (\`valid\`: true)

- Normalize sloppy wording into polished **Acme-style product titles**.
- For hazardous substances or creatures, phrase the **shipped package**, not loose reality (crates, cylinders, reinforced containers).

Example **valid** line:

{
  "valid": true,
  "name": "Beehive",
  "affinities": [
    { "role": "entity_modification", "target": "road_runner", "mode": "direct", "aptness": 0.7 },
    { "role": "terminal", "aptness": 0.5 }
  ]
}

Example **invalid** line:

{
  "valid": false,
  "name": "Justice",
  "errorType": "Not tangible",
  "affinities": []
}

## Role possibilities (\`affinities\`) for **\`valid\`: true**

Emit **1–3** possibilities per deliverable line. **Omit** aptness **strictly below ${floor}**.

### entity_modification

Include **\`target\`**: coyote | road_runner | environment and **\`mode\`**: direct | constructive.

### Structural roles

**terminal**, **trigger**, **delivery**, **autonomous_agent** — include **\`aptness\`** only (no target/mode).

## Failure and confidence

- Optional root **\`confidence\`**: **[0, 1]** for this pass.
- If **\`valid\`: true** but you cannot justify affinities, set **\`affinitiesFailed\`**: true and **\`affinities\`**: [].

## Output shape

Output **only** one JSON object, no markdown fences.

{
  "lines": [
    { "valid": true, "name": "<string>", "affinities": [ { "role": "terminal", "aptness": 0.5 } ] },
    { "valid": false, "name": "<string>", "errorType": "Not a thing", "affinities": [] }
  ],
  "confidence": <optional number 0..1>
}
`

    const dynamicSuffix = `## Player command (full string)

${commandBlock}
`

    return { invariantPrefix, dynamicSuffix }
}
