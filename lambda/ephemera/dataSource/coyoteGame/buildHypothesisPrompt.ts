import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { formatCoyoteStagedObjectsByRoom } from './coyoteRoomObjectSnapshot'

export type BuildHypothesisPromptInput = {
    roomObjectsByRoom: Record<EphemeraRoomId, string[]>
}

export type CoyotePromptParts = {
    invariantPrefix: string
    dynamicSuffix: string
}

const HYPOTHESIS_PROMPT_LINES_TEMPLATE = (snapshotSection: string) =>
    [
        'You are inferring the player\'s current plan in a cartoon Coyote environment from a staged set of Acme objects distributed across a small world.',
        '',
        'Your job is to produce a concise, provisional hypothesis about what the player appears to be trying to do.',
        '',
        '## World topology',
        '- STRAIGHTAWAY is west of VORTEX. It is a long desert highway lined with cacti, stretching toward the western horizon.',
        '- VORTEX is the starting room. The highway passes the base of a tall, sheer cliff here.',
        '- CLIFFTOP is directly above VORTEX. A boulder sits near the cliff edge.',
        '- CORNER is east of VORTEX. The road continues east, then turns sharply south, bending away from a rock face.',
        '- BRIDGE is south of CORNER. It is a bridge over a yawning chasm, carrying the road north-south.',
        '',
        '## Cartoon opportunity points',
        '- Objects placed on CLIFFTOP may imply a plan to drop or release the boulder onto the road below at VORTEX.',
        '- Objects placed near CORNER may imply a plan for the Road Runner to collide with the rock face, overshoot the turn, or be redirected by the bend in the road.',
        '- Objects placed on BRIDGE may imply a collapse, a fake crossing, a trap over the chasm, or a break in the road.',
        '- Objects placed on STRAIGHTAWAY may imply a chase setup, acceleration, bait, or a long run-up.',
        '- Read object placement spatially. Room choice matters, not just the object names.',
        '',
        '## Interpretation rules',
        '- Address the player in second person, using "you" and "your", not "the player" or "the Coyote".',
        '- Assume the player is intelligent and intentional, even when the setup is absurd.',
        '- Prefer coherent cartoon-logic readings over random lists of props.',
        '- Focus on what you think the player is trying to make happen to the Road Runner.',
        '- Choose the single most plausible detailed plan suggested by the staged objects and their room placement.',
        '- If several readings are possible, select the strongest one and state it as your best current guess.',
        '- Prefer one coherent cartoon action chain over a broad summary or a list of possibilities.',
        '- Do not list multiple possible plans, branches, or alternatives.',
        '- Do not use ambiguous either-or phrasing like "either ... or ...", "possibly", "maybe", or "perhaps".',
        '- Do not summarize the setup as a vague theme like "a chase" if the objects support a more specific trap or sequence.',
        '- Do not mention likely failure, backfire, irony, or the Coyote getting hurt.',
        '- Keep the tone intellectually humble and provisional, as if you are making your best current guess from incomplete evidence.',
        '- Prefer phrasing like "Hypothesis: It looks like you are trying to ..." or "Hypothesis: It seems like you are trying to ...".',
        '- Good style: "Hypothesis: It looks like you are trying to use the roller skates to build speed, then send the Road Runner into a rope-triggered rocket trap further down the straightaway."',
        '- Bad style: "Hypothesis: It seems like you are trying to set up a chase using the roller skates and the rocket and rope to either propel or trap the Road Runner."',
        '- Respond with only one plain-text sentence beginning exactly with "Hypothesis:". No markdown, no JSON, no extra commentary.',
        '',
        '## Current staged objects by room',
        snapshotSection || '(none)',
    ] as const

/** Invariant instruction block + per-request snapshot, for Bedrock prompt caching. */
export function buildHypothesisPromptParts(input: BuildHypothesisPromptInput): CoyotePromptParts {
    const snapshotSection = formatCoyoteStagedObjectsByRoom(input.roomObjectsByRoom)
    const lines = [...HYPOTHESIS_PROMPT_LINES_TEMPLATE(snapshotSection)]
    const splitAt = 47
    return {
        invariantPrefix: lines.slice(0, splitAt).join('\n'),
        // Leading newline pairs with the blank line before "## Current staged objects…" in the full prompt.
        dynamicSuffix: '\n' + lines.slice(splitAt).join('\n'),
    }
}

export function buildHypothesisPrompt(input: BuildHypothesisPromptInput): string {
    const { invariantPrefix, dynamicSuffix } = buildHypothesisPromptParts(input)
    return invariantPrefix + dynamicSuffix
}
