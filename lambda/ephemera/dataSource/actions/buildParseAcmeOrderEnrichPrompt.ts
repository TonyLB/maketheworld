/**
 * Step B: Acme order enrichment (catalog name and affinities).
 */

import { COYOTE_AFFINITY_APTNESS_MIN } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { ParseAcmeOrderEnrichPromptParts } from '../../generateExample/invokeBedrockAcmeOrderEnrich'

export function buildParseAcmeOrderEnrichPrompt(
    command: string,
    validLineNames: string[]
): ParseAcmeOrderEnrichPromptParts {
    const trimmed = command.trim()
    const commandBlock = trimmed === '' ? '(empty command)' : trimmed
    const catalogBlock = validLineNames.length > 0
        ? validLineNames.map((name, i) => `${i + 1}. ${name}`).join('\n')
        : '(none)'

    const floor = COYOTE_AFFINITY_APTNESS_MIN

    const invariantPrefix = `You enrich **Acme mail-order line items** for a Coyote vs. Road Runner cartoon-contraption game. Players order props and gadgets; plans are **physical gags**, trebuchets, traps, and chase mechanics - not tabletop RPG sessions. Output structured JSON only.

The **player command** and **numbered valid line items** appear at the end of this prompt. Your JSON \`lines\` array must contain **exactly** as many objects as there are numbered entries in that list, in the **same order**.

## Tone and wording (mandatory)

- Write each line's \`name\` and implied roles in **cartoon physics / contraption** language: slapstick, Acme catalog, chase comedy.
- Prefer descriptions with salesman-like color (e.g. "Acme dynamite, 100% guaranteed to explode").

## Catalog \`name\`

- Normalize sloppy player wording into polished **Acme-style product titles** (\`name\`).
- Capitalize titles like brochure headings.
- For substances or creatures that must arrive contained, phrase the **shipped package** in the title, not loose hazardous raw reality (pressurized cylinders, crates, aquariums, reinforced crates).

Example shape (structure only):

{
  "name": "Beehive (prefilled portable hive)",
  "affinities": [
    { "role": "entity_modification", "target": "road_runner", "mode": "direct", "aptness": 0.7 },
    { "role": "terminal", "aptness": 0.5 }
  ]
}

## Role possibilities (\`affinities\`)

Each object may participate in plans in multiple ways. Emit an \`affinities\` array of **role possibilities**. Each possibility includes \`aptness\` in **[0, 1]**: how plausible that role is **for this object in isolation**. Co-staged props change what actually gets built; **highest aptness is not always** the role the Coyote ends up using.

Typically output **1-3** possibilities per line. **Omit** any possibility with aptness **strictly below ${floor}** (server-side tooling may drop marginal entries too).

### \`entity_modification\`

The object (or an obvious construct built from it) changes **Coyote**, **Road Runner**, or the **environment**.

- Include \`target\`: \`coyote\` | \`road_runner\` | \`environment\`
- Include \`mode\`:
  - \`direct\`: the object itself applies the modification (paint, costume, bee swarm contact, glue patch).
  - \`constructive\`: the order implies assembling or deploying something that then modifies the entity (building a ramp, digging a pit, installing a tripwire rig).

### Structural execution roles (no \`target\` / \`mode\`)

- **terminal**: Delivers the intended payoff toward the Road Runner (explosion, splash, crush, launch into view); at most one terminal beat per complete plan, but multiple props might *look* terminal-ish - rank by aptness honestly.
- **trigger**: Starts or trips the next beat when a physical condition is met (tripwire, pressure plate, fuse ignited, latch released).
- **delivery**: Moves energy, mass, or hazard **between** pieces (rope pull, conveyor segment, marble run section, cable run).
- **autonomous_agent**: Self-propelled hazard or sub-contraption that keeps going without the Coyote steering each tick (rocket sled segment, rolling barrel, swarm cloud).

## Failure and confidence

- Optional root \`confidence\`: your confidence in this enrichment pass, **[0, 1]**.
- If you cannot justify **affinities** for a line, set \`affinitiesFailed\`: true on that line and \`affinities\` to \`[]\`.

## Output shape

Output **only** one JSON object, no markdown fences, no text before or after.

{
  "lines": [
    {
      "name": "<string>",
      "affinities": [ { "role": "terminal", "aptness": 0.5 } ]
    }
  ],
  "confidence": <optional number 0..1>
}
`

    const dynamicSuffix = `## Player command

${commandBlock}

## Valid line items to enrich

These are the **valid** catalog lines from intent parsing, **in order**. Your \`lines\` array must have **exactly** this many entries, in the **same order**.

${catalogBlock}
`

    return { invariantPrefix, dynamicSuffix }
}
