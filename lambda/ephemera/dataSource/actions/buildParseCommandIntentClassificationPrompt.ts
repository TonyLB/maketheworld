/**
 * First-draft prompt: classify player command text, with **AwaitRoadRunner** checked first,
 * then **Unimplemented** vs **Unknown**.
 */

export function buildParseCommandIntentClassificationPrompt(command: string): string {
    const trimmed = command.trim()
    const commandBlock = trimmed === '' ? '(empty command)' : trimmed

    return `You are a parser for a text-based multiplayer game with a Coyote / Road Runner cartoon vibe. Players type short commands (verbs, directions, object names, slang). Your job is to classify a single line of input into exactly one JSON outcome for this pipeline step.

## Decision order (mandatory)

1. **First** ask whether the line is about **waiting for the Road Runner**, **biding time**, **holding until the right moment**, or **laying low until the perfect time to spring the coyote's plan** (ambush patience, "not yet", "I'll wait", scheme timing, ACME trap readiness, similar). If yes, choose **AwaitRoadRunner** even if the wording could also look like a generic "wait" command.
2. **Only if not** (1), choose **Unimplemented** vs **Unknown** using the definitions below.

## Outcomes (choose exactly one)

1. **AwaitRoadRunner** — The player is signaling **patience tied to the chase / trap / scheme**: waiting for Road Runner to show up, waiting to strike, holding for the right beat, not rushing the plan, coyote-style "the moment is not ripe" energy. Include playful or terse phrasing if it clearly maps to that fiction (e.g. "wait for the bird", "hold the trap", "not yet", "bide my time").

2. **Unimplemented** — The player clearly intends a **different** in-world action (not primarily about that wait-for-road-runner / scheme-timing beat), but the **specific action or target is not implemented** in this first-cut parser (e.g. inventory, crafting, combat, unrelated NPC talk). Coherent game intent we do not support yet.

3. **Unknown** — You **cannot** extract a sensible **in-world** intent. Random characters, pure OOC/meta chatter, ambiguous fragments, keyboard mash, empty noise, or text that could be many unrelated things with no reasonable default.

## Rules

- **AwaitRoadRunner** outranks **Unimplemented** and **Unknown** whenever the wait / timing / road-runner / coyote-plan reading is **plausible**; prefer it on a **borderline** if the line could be read as coyote-and-road-runner patience.
- Prefer **Unimplemented** for other plausible game commands (imperative, direction, verb + object) that are **not** mainly the wait/scheme-timing beat above.
- Prefer **Unknown** when there is **no** reasonable in-world action, or the input is **primarily** social/meta/not directed at the game simulation.
- Output **only** a single JSON object, no markdown fences, no explanation before or after.
- \`confidence\` is a number from 0 through 1 (how sure you are of this classification).

## Required JSON shape (exactly one of)

{ "type": "AwaitRoadRunner", "confidence": <number> }

or

{ "type": "Unimplemented", "confidence": <number> }

or

{ "type": "Unknown", "confidence": <number> }

The \`type\` string must be exactly \`AwaitRoadRunner\`, \`Unimplemented\`, or \`Unknown\` (case-sensitive). Do not add other keys.

## Player input

${commandBlock}
`
}
