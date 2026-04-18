/**
 * Step B: Acme order enrichment (catalog name, description, affinities).
 * Phase 2 placeholder — lifts packaging / catalog behavior out of intent classification;
 * Phase 3 deepens affinity vocabulary and aptness rules.
 */

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

    const invariantPrefix = `You enrich **Acme mail-order line items** for a Coyote / Road Runner cartoon game. Output structured JSON only.

The **player command** and **numbered valid line items** appear at the end of this prompt. Your JSON \`lines\` array must contain **exactly** as many objects as there are numbered entries in that list, in the **same order**.

## Catalog rules

- Each **line** object: \`name\` (Acme product title), \`description\` (short in-world blurb), \`affinities\` (array of plan-role possibilities with \`aptness\` from 0 through 1). Frame roles in **contraption / cartoon-physics** terms; **no RPG jargon**.
- For items that can only ship in containment (hydrogen gas, piranhas, etc.), use packaged deliverable **names** like "pressurized bottle of hydrogen gas" or "huge aquarium of piranhas", not raw uncontained wording.
- Optional root \`confidence\`: your confidence in this enrichment pass, a number from 0 through 1.
- If you cannot produce **affinities** for a given line, set \`affinitiesFailed\`: true on that line and set \`description\` to \`""\` and \`affinities\` to \`[]\`.

## Affinity entries (discriminate on \`role\`)

- \`entity_modification\`: include \`target\` (\`coyote\` | \`road_runner\` | \`environment\`), \`mode\` (\`direct\` | \`constructive\`), \`aptness\`.
- Structural roles: \`terminal\`, \`trigger\`, \`delivery\`, \`autonomous_agent\` — include \`aptness\` only.

## Output shape

Output **only** one JSON object, no markdown fences, no text before or after.

{
  "lines": [
    {
      "name": "<string>",
      "description": "<string>",
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
