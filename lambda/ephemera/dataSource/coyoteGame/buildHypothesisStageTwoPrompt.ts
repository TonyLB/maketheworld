import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyotePromptParts } from './buildHypothesisPrompt'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
    SNAPSHOT_SECTION_HEADER,
} from './coyoteHypothesisPromptShared'
import { formatCoyoteStagedObjectsByRoom } from './coyoteRoomObjectSnapshot'

export type BuildHypothesisStageTwoPromptInput = {
    roomObjectsByRoom: Record<EphemeraRoomId, string[]>
    seamMarkdown: string
}

const STAGE_TWO_INTRO_LINES = [
    'You are completing the player-facing hypothesis for a Coyote-vs-Road-Runner cartoon setup.',
    '',
    'The dynamic section below contains a **stage-1 structured seam** (clustering + affinities) and the **current staged objects by room**. Use both together with the fixed world context in this message.',
    '- Write a brief scene analysis under "## Scene analysis" for the player.',
    '- Then output exactly one plain-text line beginning with "Hypothesis:".',
    '- Structured markdown (including ## headings) is allowed only before the Hypothesis line; the Hypothesis line itself is plain text.',
] as const

const INTERPRETATION_RULES_LINES = [
    '## Interpretation rules',
    '- Address the player in second person, using "you" and "your", not "the player" or "the Coyote".',
    '- Assume the player is intelligent and intentional, even when the setup is absurd.',
    '- Prefer coherent cartoon-logic readings over random lists of props.',
    '- Focus on what you think the player is trying to make happen to the Road Runner.',
    '- Choose the single most plausible detailed plan suggested by the staged objects and their room placement.',
    '- Do not use ambiguous either-or phrasing like "either ... or ...", "possibly", "maybe", or "perhaps".',
    '- Do not summarize the setup as a vague theme like "a chase" if the objects support a more specific trap or sequence.',
    '- Do not mention likely failure, backfire, irony, or the Coyote getting hurt.',
    '- Prefer phrasing like "Hypothesis: It looks like you are trying to ..." or "Hypothesis: It seems like you are trying to ...".',
    '- Uncertainty belongs only in that Hypothesis framing ("It looks like ..."). After it, narrate one committed plan in order, like a confident play-by-play - not another round of hedging.',
    '- Describe the chosen reading like sketching the perfect caper: a single ordered run through the geography and staged objects (what happens first, next, then), as if each step lands - not a survey of options and not hedging between beats.',
    '- Good style: "Hypothesis: It looks like you are trying to use the roller skates to build speed, then send the Road Runner into a rope-triggered rocket trap further down the straightaway."',
    '- Bad style: "Hypothesis: It seems like you are trying to set up a chase using the roller skates and the rocket and rope to either propel or trap the Road Runner."',
] as const

const SCENE_AND_HYPOTHESIS_LINES = [
    '## Scene analysis and Hypothesis output',
    '- Your "## Scene analysis" section should commit to a single reading and build the spatial and causal logic behind it. Do not survey multiple plans there; the Hypothesis restates that same reading as one sentence.',
    '- Ground your "## Scene analysis" section on the stage-1 seam and the spatial layout; narrate for the player without contradicting the seam.',
    '- After "## Scene analysis", respond with one plain-text sentence on its own line beginning exactly with "Hypothesis:".',
    '- No JSON. No extra commentary outside "## Scene analysis" (markdown allowed there) and the Hypothesis line.',
] as const

const DYNAMIC_SECTION_INTRO = [
    '',
    'The following blocks are specific to this request (stage-1 seam, then live snapshot):',
    '',
    '## Stage 1 seam (structured Markdown)',
] as const

/** Stage 2: topology + interpretation + scene/hypothesis rules invariant; dynamic tail = seam + snapshot (cached tail varies per request). */
export function buildHypothesisStageTwoPromptParts(input: BuildHypothesisStageTwoPromptInput): CoyotePromptParts {
    const snapshotSection = formatCoyoteStagedObjectsByRoom(input.roomObjectsByRoom)
    const seamRoomMappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const invariantPrefix = [
        ...STAGE_TWO_INTRO_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...INTERPRETATION_RULES_LINES,
        '',
        ...SCENE_AND_HYPOTHESIS_LINES,
        ...DYNAMIC_SECTION_INTRO,
    ].join('\n')

    const dynamicSuffix = [
        '',
        seamRoomMappingBlock,
        '',
        input.seamMarkdown.trim(),
        '',
        SNAPSHOT_SECTION_HEADER,
        snapshotSection || '(none)',
    ].join('\n')

    return {
        invariantPrefix,
        dynamicSuffix: `\n${dynamicSuffix}`,
    }
}
