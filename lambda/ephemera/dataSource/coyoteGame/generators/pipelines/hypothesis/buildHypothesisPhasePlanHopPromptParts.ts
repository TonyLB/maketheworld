import type { CoyotePromptParts } from './buildHypothesisPrompt'
import {
    COMBINED_CLUSTERING_CONTRACT_LINES,
    INTERPRETATION_RULES_LINES,
    TEMPORAL_ORDERING_LINES,
    VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES,
} from './buildHypothesisStageTwoPrompt'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
} from './coyoteHypothesisPromptShared'
import type { CoyoteHop1Handoff } from './coyoteHop1Handoff'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

export type BuildHypothesisPhasePlanHopPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    combinedMarkdown: string
    hop1Handoff: CoyoteHop1Handoff
}

const PHASE_PLAN_HOP_INTRO = [
    'You are completing the structured phase plan and player-facing hypothesis for a Coyote-vs-Road-Runner cartoon setup.',
    '',
    '## Grounding from plan selection (authoritative)',
    'The **chosen plan summary** and **rubric issues** below were produced by an',
    'earlier selection step. Treat them as the committed maneuver --- do not',
    'substitute a different plan or revert to comparing alternatives.',
    '',
    '## Output order (strict)',
    '1. **First**, output **one** Markdown **` ```json ` ** fenced block whose JSON has',
    '   **exactly** a top-level **`phases`** key (non-empty array). Each phase object',
    '   includes **`stableKeysUsed`**, **`virtualEntities`** (each with **`label`**,',
    '   **`derivedFrom`** string array, **`phaseKind`** gathered | synthesized |',
    '   deployed), and **`achievement`**. Optional **`prepVsBeat`**: prep | creation.',
    '   - Reference staged objects only by **`stableKey`** from the snapshot /',
    '     combined clustering. For virtual entities, **`derivedFrom`** may cite',
    '     snapshot keys, seam room labels / topology tokens consistent with prompts,',
    '     or the reserved grounding token **`setting`** (cartoon stock affordances)',
    '     where no staged row applies --- see interfaces package validators.',
    '2. **Second**, write **`## Scene analysis`** (Markdown): chain-of-reasoning and',
    '   spatial analysis for the player for **this** plan only.',
    '3. **Third**, after "## Scene analysis", output a **final** fenced block with',
    '   language **`text`** whose **only** content is exactly one plain-text line',
    '   beginning with "Hypothesis:".',
    '4. Do not put any other text after the closing **` ```text ` ** fence.',
    '5. Even if you are unsure about the JSON details, still provide a complete',
    '   "## Scene analysis" and final Hypothesis line (downstream systems can',
    '   preserve prose when structured JSON needs correction).',
    '',
    '## Scene analysis and Hypothesis output',
    '- Your "## Scene analysis" section should commit to the single reading above and',
    '  build spatial and causal logic. Do not survey multiple plans.',
    '- Ground "## Scene analysis" on **combined clustering**, **## Outliers**,',
    '  topology, and the plan-selection grounding block.',
    '- Open **` ```text ` ** only after "## Scene analysis". The fenced interior must contain **only** the Hypothesis line.',
    '- No extra commentary outside the leading **` ```json ` ** phase plan,',
    '  "## Scene analysis", and the fenced Hypothesis line.',
] as const

const SCENE_ANALYSIS_AND_FENCED_HYPOTHESIS_LINES = [
    '## Scene analysis and fenced Hypothesis (assistant text only)',
    '- Put **planning, ordering, and topology** in "## Scene analysis" in the',
    '  assistant **text** stream (**body**). Do not rely on a separate Nova',
    '  reasoning channel.',
    '- The **final** ```text fence must contain **only** the Hypothesis line so parsers can slice it reliably.',
] as const

function formatHop1HandoffBlock(handoff: CoyoteHop1Handoff): string {
    const issues =
        handoff.rubricIssues.length > 0
            ? handoff.rubricIssues.map((line) => `- ${line}`).join('\n')
            : '- (none)'
    return ['## Plan selection grounding', '', '**Chosen plan summary:**', '', handoff.paragraphSummary.trim(), '', '**Rubric issues:**', issues].join('\n')
}

/** Option A hop 2: phase-plan JSON first, then "## Scene analysis", then fenced Hypothesis line. */
export function buildHypothesisPhasePlanHopPromptParts(
    input: BuildHypothesisPhasePlanHopPromptInput
): CoyotePromptParts {
    const seamRoomMappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const handoffBlock = formatHop1HandoffBlock(input.hop1Handoff)
    const invariantPrefix = [
        ...PHASE_PLAN_HOP_INTRO,
        '',
        ...COMBINED_CLUSTERING_CONTRACT_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...INTERPRETATION_RULES_LINES,
        '',
        ...TEMPORAL_ORDERING_LINES,
        '',
        ...VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES,
        '',
        ...SCENE_ANALYSIS_AND_FENCED_HYPOTHESIS_LINES,
        '',
        'The following blocks are specific to this request:',
        '',
        handoffBlock,
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
