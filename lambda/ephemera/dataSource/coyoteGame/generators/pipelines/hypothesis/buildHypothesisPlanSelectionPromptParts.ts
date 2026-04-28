import type { CoyotePromptParts } from './buildHypothesisPrompt'
import { COMBINED_CLUSTERING_CONTRACT_LINES } from './buildHypothesisStageTwoPrompt'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
} from './coyoteHypothesisPromptShared'
import { COYOTE_HOP1_HANDOFF_JSON_KEYS } from './coyoteHop1Handoff'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

export type BuildHypothesisPlanSelectionPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    combinedMarkdown: string
    /** Number of competing one-line plan sketches (default 3). */
    planSketchCount?: number
}

const DEFAULT_PLAN_SKETCH_COUNT = 3

const PLAN_SELECTION_READING_RULES = [
    '## Reading the setup (for matrix cells)',
    '- Address the player in second person ("you") when describing what a plan would do.',
    '- Never reinterpret Road Runner roles as Coyote gear-building instructions.',
    '- Ground evidence in **stableKey**, cluster membership, and **## Outliers** ---',
    '  outliers are eligible props; do not fold them into named clusters they were',
    '  not assigned to.',
] as const

const PLAN_SELECTION_INTRO = [
    'You are comparing competing high-level Coyote-vs-Road-Runner maneuver sketches before the detailed hypothesis is written.',
    '',
    'Use the **combined clustering** block below as ground truth for staged objects, clusters, outliers, and intended roles.',
    '',
    '## Task',
    '- Ground yourself briefly on the setup (short prose before the matrix is fine).',
    `- Produce exactly **N** distinct one-line **plan sketches** (numbered or labeled consistently) where **N** is specified below.`,
    '- Build a **criterion-first rubric matrix**: **one row per plan sketch**,',
    '  **one column per dimension**: **coverage**, **completeness**, **coherence**.',
    '- Each matrix cell: short, evidence-grounded prose referencing **stableKey** and',
    '  cluster membership where relevant --- comparison, not abstract letter grades.',
    '- Treat **coverage**, **completeness**, and **coherence** as **equally important**',
    '  when judging rows. Do not emphasize one dimension over another in prose or',
    '  tie-break language.',
    '- Do **not** grade or bias sketches on Road Runner safety, villain effectiveness,',
    '  or outcome comedy --- those belong to later execution prompts, not this rubric.',
    '- After the matrix: **selection second** --- pick exactly **one** winning sketch',
    '  with no ties unless you apply an explicit tie-break stated in one line',
    '  (prefer avoiding ties). You may rank ordinally (1 = best) or name the winner',
    '  matching the sketch labels.',
    '- End your reply with **only** a Markdown **` ```json ` ** fenced block',
    '  (language tag **json**) containing at least these required keys: **`',
    COYOTE_HOP1_HANDOFF_JSON_KEYS.paragraphSummary,
    '`** (string: one paragraph summarizing the **chosen** plan only) and',
    '  **`',
    COYOTE_HOP1_HANDOFF_JSON_KEYS.rubricIssues,
    '`** (array of strings: concrete issues / gaps from the rubric for that chosen',
    '  plan --- staged keys still vague, synthesis needs, etc.). Additional keys are',
    '  allowed, but these two keys must be present and well-typed.',
    '- The **` ```json ` ** block must be the **last** fence in your output.',
] as const

export function buildHypothesisPlanSelectionPromptParts(
    input: BuildHypothesisPlanSelectionPromptInput
): CoyotePromptParts {
    const n = input.planSketchCount ?? DEFAULT_PLAN_SKETCH_COUNT
    const seamRoomMappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const invariantPrefix = [
        ...PLAN_SELECTION_INTRO,
        '',
        `Use **${n}** plan sketches.`,
        '',
        '## Rubric dimensions',
        '- **coverage** --- how much each staged prop / affordance can contribute to the plan.',
        '- **completeness** --- how much everything **needed** by the plan is already present or constructable from staged props and topology (including synthesis implied by the plan).',
        '- **coherence** --- how well implied actions reinforce each other toward one maneuver.',
        '',
        ...COMBINED_CLUSTERING_CONTRACT_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...PLAN_SELECTION_READING_RULES,
        '',
        'The following blocks are specific to this request (seam room labels, then combined clustering):',
        '',
        '## Combined clustering input (structured Markdown)',
    ].join('\n')

    const dynamicSuffix = [
        '',
        seamRoomMappingBlock,
        '',
        input.combinedMarkdown.trim(),
        '',
    ].join('\n')

    return {
        invariantPrefix,
        dynamicSuffix: `\n${dynamicSuffix}`,
    }
}
