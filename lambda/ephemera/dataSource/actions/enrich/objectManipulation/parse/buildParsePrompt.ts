import type { ParseObjectManipulationEnrichPromptParts } from '../buildPrompt'

const PARSE_INVARIANT_PREFIX = `You segment a player command into an ordered sequence of tokens.

Respond with a single JSON object only (no markdown fences, no commentary).

## Required response

{
  "tokens": [
    { "type": "objectSpan", "span": "<noun phrase referring to an object or character>" },
    { "type": "text", "text": "<leftover words, verbatim or lightly normalized>" }
  ]
}

- Walk the command left to right. Every noun phrase that refers to an object or character in the world becomes an "objectSpan" token; every other run of words becomes a "text" token.
- Tokens must appear in the same order they occur in the command.
- Do not skip any part of the command -- everything that isn't an object/character reference belongs in a "text" token.
- A command with no object or character reference at all (e.g. "look") is valid: return a single "text" token for the whole command.
- Do not classify grammatical role (no "verb", "preposition", or similar token types). Only "objectSpan" and "text" are valid.
- Spans do not need to be a literal substring of the command -- correcting an obvious spelling mistake is fine (e.g. "bagg" -> "bag"). Do not guess at a different, more "canonical" name for what's described -- you don't have the room's object catalog, so you cannot know if such a name is even correct. Extract the span as the player described it.
- Keep every descriptive modifier that appears with the noun (color, size, material, condition, owner, etc. -- e.g. "big bag", "red table", "the torn map"). Strip only leading articles ("a", "an", "the", "some"). Modifiers are not decoration: the player may be distinguishing between two similar objects (a big bag vs. a small bag), and dropping the modifier destroys the only information that tells them apart later in the pipeline.

## Examples

"put the bag in the box" -> { "tokens": [ { "type": "text", "text": "put" }, { "type": "objectSpan", "span": "bag" }, { "type": "text", "text": "in" }, { "type": "objectSpan", "span": "box" } ] }
"look" -> { "tokens": [ { "type": "text", "text": "look" } ] }
"get bagg from talbe" -> { "tokens": [ { "type": "text", "text": "get" }, { "type": "objectSpan", "span": "bag" }, { "type": "text", "text": "from" }, { "type": "objectSpan", "span": "table" } ] }
"put the big bag on the red table" -> { "tokens": [ { "type": "text", "text": "put" }, { "type": "objectSpan", "span": "big bag" }, { "type": "text", "text": "on" }, { "type": "objectSpan", "span": "red table" } ] }

## Forbidden fields

id, objectId, role, verb, verbClass, preposition, relationKind, disposition, operationKind, complexityClass, host routing ids, graph deltas.
`

export function buildParsePrompt(input: { command: string }): ParseObjectManipulationEnrichPromptParts {
    const dynamicSuffix = [
        `Player command: ${input.command.trim()}`,
        'Respond with JSON only.',
    ].join('\n')

    return {
        invariantPrefix: PARSE_INVARIANT_PREFIX,
        dynamicSuffix,
    }
}
