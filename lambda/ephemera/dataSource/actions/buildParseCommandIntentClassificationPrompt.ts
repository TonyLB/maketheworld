/**
 * First-draft prompt: high-priority **AwaitRoadRunner** and **AcmeOrder**, then **Unimplemented** vs **Unknown**.
 */

export function buildParseCommandIntentClassificationPrompt(command: string): string {
    const trimmed = command.trim()
    const commandBlock = trimmed === '' ? '(empty command)' : trimmed

    return `You are a parser for a text-based multiplayer game with a Coyote / Road Runner cartoon vibe. Players type short commands (verbs, directions, object names, slang). Your job is to classify a single line of input into exactly one JSON outcome for this pipeline step.

## Decision order (mandatory)

**Before** choosing Unimplemented or Unknown, evaluate **AwaitRoadRunner** and **AcmeOrder** as **same-tier** special intents (either can win; see tie-break below).

### A — AwaitRoadRunner

Choose **AwaitRoadRunner** when the line is **primarily** about **waiting for the Road Runner**, **biding time**, **holding until the right moment**, or **laying low until the perfect time to spring the coyote's plan** (ambush patience, "not yet", scheme timing, ACME trap readiness). Examples: "wait for the bird", "hold the trap", "bide my time", "not yet".

### B — AcmeOrder

Choose **AcmeOrder** when the line is **primarily** about **ordering or buying goods from Acme** (catalog, mail-order, telephone order, unspecified delivery method, "send away for", "I need from Acme", product requests). Extract **what** they want as one or more short product strings in \`orders\` (e.g. one item: \`["rocket-powered roller skates"]\`; several: \`["anvil", "spring-loaded boxing glove"]\`). Use **concise** noun phrases; split distinct products into separate array entries.

### Tie-break when both A and B could apply

Prefer **AcmeOrder** when **commerce / catalog / product** language is central (verbs like order, buy, mail, send for, plus product nouns). Prefer **AwaitRoadRunner** when **patience / timing / the chase** is central with **no** clear product order. If still ambiguous, prefer **AwaitRoadRunner**.

### After A / B

If neither A nor B applies, choose **Unimplemented** vs **Unknown** as follows.

## Outcomes (choose exactly one)

1. **AwaitRoadRunner** — As in section A.

2. **AcmeOrder** — As in section B. You **must** include \`orders\`: a JSON array of one or more non-empty strings.

3. **Unimplemented** — Clear **other** in-world intent we do not implement yet (not mainly A or B).

4. **Unknown** — No sensible in-world intent (noise, OOC/meta, mash, empty).

## Rules

- Output **only** a single JSON object, no markdown fences, no explanation before or after.
- \`confidence\` is a number from 0 through 1.
- For **AcmeOrder**, \`orders\` must be a JSON array of strings; use at least one string. Do not use a single \`order\` string field unless you also provide \`orders\` (prefer \`orders\` only).

## Required JSON shapes

{ "type": "AwaitRoadRunner", "confidence": <number> }

or

{ "type": "AcmeOrder", "orders": [ "<product>", ... ], "confidence": <number> }

or

{ "type": "Unimplemented", "confidence": <number> }

or

{ "type": "Unknown", "confidence": <number> }

The \`type\` string must be exactly \`AwaitRoadRunner\`, \`AcmeOrder\`, \`Unimplemented\`, or \`Unknown\` (case-sensitive). For **AcmeOrder**, include only \`type\`, \`confidence\`, and \`orders\` (or a single \`order\` string for one product if you cannot produce an array).

## Player input

${commandBlock}
`
}
