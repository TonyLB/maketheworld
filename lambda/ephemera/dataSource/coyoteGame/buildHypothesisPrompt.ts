import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    SNAPSHOT_SECTION_HEADER,
    splitCoyoteHypothesisLinesAtSnapshot,
} from './coyoteHypothesisPromptShared'
import { formatCoyoteStagedObjectsByRoom } from './coyoteRoomObjectSnapshot'

export type BuildHypothesisPromptInput = {
    roomObjectsByRoom: Record<EphemeraRoomId, string[]>
}

export type CoyotePromptParts = {
    invariantPrefix: string
    dynamicSuffix: string
}

export { SNAPSHOT_SECTION_HEADER }

/** @deprecated Legacy single-call hypothesis prompt — replaced by stage 1 + stage 2 builders in the two-round pipeline. */
const HYPOTHESIS_PROMPT_LINES_TEMPLATE = (snapshotSection: string) =>
    [
        'You are inferring the player\'s current plan in a cartoon Coyote environment from a staged set of Acme objects distributed across a small world.',
        '',
        'Your job is to produce a concise, provisional hypothesis about what the player appears to be trying to do.',
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        '## Actor affinities',
        '- The Coyote is a physical participant in plans: he wears, rides, and operates equipment himself.',
        '- Objects requiring sustained intentional operation (vehicles, wearables, aimed or steered devices) have Coyote-affinity: they belong to him and he uses them.',
        '- Objects that work passively or trigger on contact (trip-wires, fake signs, painted tunnels, dropped weights) have Road-Runner-trap-affinity.',
        '- The Road Runner is fast but passive. He does not operate machinery or steer devices. Plans that require him to do so are probably misread.',
        '- Bait and consumables are ambiguous; treat them as context-dependent.',
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
        '- Structured markdown (including ## headings) is allowed only in the scene-analysis section below. The hypothesis line itself must be plain text starting with "Hypothesis:".',
        '## Scene analysis instructions',
        '- Before stating your hypothesis, write a brief scene analysis under the header "## Scene analysis".',
        '- For each object, note: its likely function, and its actor-affinity (Coyote-operated, Road-Runner-trap, or ambiguous).',
        '- Then identify one or two clusters: groups of objects that share affinity, co-locate, or plausibly support a common activity. Name each cluster and state what it suggests about the Coyote\'s role (participant vs. trap-setter).',
        '- This analysis is not the hypothesis. It is scaffolding. Use it to ground your final answer.',
        '- After your scene analysis, respond with one plain-text sentence on its own line beginning exactly with "Hypothesis:". No JSON, no extra commentary outside the scene analysis and hypothesis line.',
        '',
        SNAPSHOT_SECTION_HEADER,
        snapshotSection || '(none)',
    ] as const

/** Invariant instruction block + per-request snapshot, for Bedrock prompt caching. */
export function buildHypothesisPromptParts(input: BuildHypothesisPromptInput): CoyotePromptParts {
    const snapshotSection = formatCoyoteStagedObjectsByRoom(input.roomObjectsByRoom)
    const lines = [...HYPOTHESIS_PROMPT_LINES_TEMPLATE(snapshotSection)]
    const splitAt = splitCoyoteHypothesisLinesAtSnapshot(lines)
    return {
        invariantPrefix: lines.slice(0, splitAt).join('\n'),
        // Leading newline pairs with the blank line before "## Current staged objects..." in the full prompt.
        dynamicSuffix: '\n' + lines.slice(splitAt).join('\n'),
    }
}

export function buildHypothesisPrompt(input: BuildHypothesisPromptInput): string {
    const { invariantPrefix, dynamicSuffix } = buildHypothesisPromptParts(input)
    return invariantPrefix + dynamicSuffix
}
