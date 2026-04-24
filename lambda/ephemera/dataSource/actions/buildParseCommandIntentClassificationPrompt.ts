/**
 * Intent classification for parse Step A: **AwaitRoadRunner**, **AcmeOrder** (intent only), **LookRoom**, **Unimplemented** vs **Unknown**.
 */

export function buildParseCommandIntentClassificationPrompt(command: string): string {
    const trimmed = command.trim()
    const commandBlock = trimmed === '' ? '(empty command)' : trimmed

    return `You are a parser for a text-based multiplayer game with a Coyote / Road Runner cartoon vibe. Players type short commands (verbs, directions, object names, slang). Your job is to classify a single line of input into exactly one JSON outcome for this pipeline step.

## Decision order (mandatory)

**Before** choosing Unimplemented or Unknown, evaluate **AwaitRoadRunner**, **AcmeOrder**, and **LookRoom** as **same-tier** special intents.

### A — AwaitRoadRunner

Choose **AwaitRoadRunner** when the line is **primarily** about **waiting for the Road Runner**, **biding time**, **holding until the right moment**, or **laying low until the perfect time to spring the coyote's plan** (ambush patience, "not yet", scheme timing, ACME trap readiness). Examples: "wait for the bird", "hold the trap", "bide my time", "not yet".

### B — AcmeOrder

Choose **AcmeOrder** when the line is **primarily** about **ordering or buying goods from Acme** (catalog, mail-order, telephone order, unspecified delivery method, "send away for", "I need from Acme", product requests).

**Do not** list products, judge catalog validity, or segment line items — a **later step** parses the command and validates **tangible vs. abstract**, **catalog membership**, **size**, **affinities**, and **normalized titles**.

### C — LookRoom

Choose **LookRoom** when the line is **primarily** about **seeing, examining, or taking in the current room or immediate surroundings** (a full look at where you are now) — e.g. "examine the room", "look around", "what's here", "describe my surroundings", "survey the area" — and **not** a targeted look at a named object, exit, or character. **Do not** choose this when the line is only the single word **look** or **l** (the game handles that elsewhere).

### Tie-breaks when more than one of A, B, or C could apply

- Prefer **AcmeOrder** when **commerce / catalog / ordering** language is central.
- Prefer **AwaitRoadRunner** when **patience / timing / the chase** is central with **no** clear product order and **no** clear "see the current space" intent.
- Prefer **LookRoom** when **perceiving the current space** (not ordering from Acme) is central and the line is **not** mainly biding for the Road Runner. If a line mixes catalog shopping with **look at** a product, that is still **AcmeOrder**, not **LookRoom**. Map clear OOC/meta or nonsense to **Unknown** (or **Unimplemented** only when there is a clear in-world intent we do not cover).

### After A, B, and C

If none of A, B, or C applies, choose **Unimplemented** vs **Unknown** as follows.

## Outcomes (choose exactly one)

1. **AwaitRoadRunner** — As in section A.

2. **AcmeOrder** — As in section B. Respond with **only** \`type\` and \`confidence\`. **Do not** include \`orders\`, \`order\`, product names, or validation fields.

3. **LookRoom** — As in section C. Respond with **only** \`type\` and \`confidence\`. No follow-up step runs for this intent in the Acme pipeline.

4. **Unimplemented** — Clear **other** in-world intent we do not implement yet (not mainly A, B, or C).

5. **Unknown** — No sensible in-world intent (noise, OOC/meta, mash, empty).

## Rules

- Output **only** a single JSON object, no markdown fences, no explanation before or after.
- \`confidence\` is a number from 0 through 1.

## Required JSON shapes

{ "type": "AwaitRoadRunner", "confidence": <number> }

or

{ "type": "AcmeOrder", "confidence": <number> }

or

{ "type": "LookRoom", "confidence": <number> }

or

{ "type": "Unimplemented", "confidence": <number> }

or

{ "type": "Unknown", "confidence": <number> }

The \`type\` string must be exactly \`AwaitRoadRunner\`, \`AcmeOrder\`, \`LookRoom\`, \`Unimplemented\`, or \`Unknown\` (case-sensitive).

## Player input

${commandBlock}
`
}
