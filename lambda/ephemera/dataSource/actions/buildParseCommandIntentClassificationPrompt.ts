/**
 * First-draft prompt: classify player command text into exactly one of
 * `Unimplemented` (clear in-world intent, not supported yet) vs `Unknown` (no sensible in-world intent).
 */

export function buildParseCommandIntentClassificationPrompt(command: string): string {
    const trimmed = command.trim()
    const commandBlock = trimmed === '' ? '(empty command)' : trimmed

    return `You are a parser for a text-based multiplayer game. Players type short commands (verbs, directions, object names, slang). Your job is to classify a single line of input into exactly one JSON outcome for this pipeline step.

## Outcomes (choose exactly one)

1. **Unimplemented** — The player clearly intends an **in-character, in-world** action (something their character is trying to do in the game fiction), but you are confident the **specific action or target is not implemented** in this first-cut parser (e.g. inventory, crafting, combat, talking to an NPC, using an item we do not handle yet). They are "playing the game" with a coherent intent; we just do not support that verb/system yet.

2. **Unknown** — You **cannot** extract a sensible **in-world** intent from the line. Examples: random characters, pure OOC/meta chatter ("anyone here?", "how do I win?"), ambiguous fragments with no clear game action, keyboard mash, empty noise, or text that could be many unrelated things with no reasonable default.

## Rules

- Prefer **Unimplemented** when the line reads like a **plausible game command** (imperative, direction, verb + object) even if vague, as long as it is clearly **not** just noise or chat.
- Prefer **Unknown** when there is **no** reasonable in-world action to attribute, or the input is **primarily** social/meta/not directed at the game simulation.
- Output **only** a single JSON object, no markdown fences, no explanation before or after.
- \`confidence\` is a number from 0 through 1 (how sure you are of this classification).

## Required JSON shape (exactly one of)

{ "type": "Unimplemented", "confidence": <number> }

or

{ "type": "Unknown", "confidence": <number> }

Do not use any other \`type\` value. Do not add other keys (omit optional reasoning for this step).

## Player input

${commandBlock}
`
}
