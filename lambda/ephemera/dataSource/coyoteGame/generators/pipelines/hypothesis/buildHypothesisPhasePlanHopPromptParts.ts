import type { CoyotePromptParts } from './buildHypothesisPrompt'
import type { CombineHypothesisClustersReturn } from './combineHypothesisClusters'
import { renderCombinedHypothesisForStageTwo } from './combineHypothesisClusters'
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
    combined: CombineHypothesisClustersReturn
    hop1Handoff: CoyoteHop1Handoff
}

const PHASE_PLAN_HOP_INTRO = [
    'You are completing the structured phase plan and player-facing hypothesis for a Coyote-vs-Road-Runner cartoon setup.',
    '',
    '## Perspective guardrail (hard constraint)',
    '- Plan and describe trope beats strictly from the Coyote\'s planning perspective for the committed maneuver.',
    '- Treat the Coyote as the sole planner/actor and the Road Runner as the target; do not frame beats as Road Runner goal fulfillment.',
    '- If any sentence drifts into Road Runner-benefiting intent (escape optimization, trap avoidance, Coyote failure as the goal), rewrite it before output as Coyote intent, Coyote setup logic, or Coyote-side deconfliction risk handling.',
    '- Keep this guardrail inside this prompt run: enforce it while producing JSON phases, scene analysis, and final Hypothesis line without adding external deterministic phase-to-phase intent checks.',
    '',
    '## Grounding from plan selection (authoritative)',
    'The **chosen plan summary** and **intent-confidence gaps** below were produced by an',
    'earlier selection step. Treat them as the committed maneuver --- do not',
    'substitute a different plan or revert to comparing alternatives.',
    '',
    '## Output order (strict)',
    '1. **First**, output **one** Markdown **` ```json ` ** fenced block whose JSON has',
    '   **exactly** top-level keys **`tropeSequence`**, **`deconflictionSummary`**, and',
    '   **`phases`**.',
    '   - **`tropeSequence`**: non-empty array of unique trope names in canonical order',
    '     (Contraption -> Distraction -> Disadvantage -> Finishing Move).',
    '   - **`deconflictionSummary`**: concise string describing final conflict resolutions.',
    '   - **`phases`**: non-empty array, one entry per trope in `tropeSequence` at the',
    '     same index. Each phase object includes **`trope`**, **`tropeBeat`** (second-draft',
    '     beat detail), **`stableKeysUsed`**, **`virtualEntities`** (each with **`label`**,',
    '     **`derivedFrom`** string array, **`phaseKind`** gathered | synthesized |',
    '     deployed), and **`achievement`**. Optional **`prepVsBeat`**: prep | creation.',
    '   - Reference staged objects only by **`stableKey`** from the snapshot /',
    '     combined clustering. For virtual entities, **`derivedFrom`** may cite',
    '     snapshot keys, seam room labels / topology tokens consistent with prompts,',
    '     or the reserved grounding token **`setting`** (cartoon stock affordances)',
    '     where no staged row applies --- see interfaces package validators.',
    '2. **Second**, write **`## Scene analysis`** (Markdown): chain-of-reasoning and',
    '   spatial analysis for the player for **this** plan only.',
    '   - Present the golden path explicitly as trope beats in sequence, matching the',
    '     same order and beat intent in `tropeSequence` + `phases[*].tropeBeat`.',
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
    return ['## Plan selection grounding', '', '**Chosen plan summary:**', '', handoff.paragraphSummary.trim(), '', '**Intent-confidence gaps:**', issues].join('\n')
}

/** Option A hop 2: phase-plan JSON first, then "## Scene analysis", then fenced Hypothesis line. */
export function buildHypothesisPhasePlanHopPromptParts(
    input: BuildHypothesisPhasePlanHopPromptInput
): CoyotePromptParts {
    const combinedMarkdown = renderCombinedHypothesisForStageTwo(
        input.combined,
        input.roomObjectsByRoom
    )
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
        combinedMarkdown.trim(),
        '',
    ].join('\n')

    return {
        invariantPrefix,
        dynamicSuffix: `\n${dynamicSuffix}`,
    }
}
