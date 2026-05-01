import type { CoyotePromptParts } from '../promptTypes'
import type { CombineCandidateOutputReturn } from '../candidates/combineCandidateOutput'
import { renderCombinedCandidateOutputForNarrativeBeat } from '../candidates/combineCandidateOutput'
import {
    COMBINED_CLUSTERING_CONTRACT_LINES,
    INTERPRETATION_RULES_LINES,
    TEMPORAL_ORDERING_LINES,
    VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES,
} from '../narrativePromptShared'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
} from '../coyoteHypothesisPromptShared'
import type { PlanSelectOutput } from '../planSelect/parsePlanSelectOutput'
import type { CoyoteRoomObjectsByRoom } from '../../../../utilities/coyoteRoomObjectSnapshot'
import type { CoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { CANONICAL_TROPE_ORDER } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'

/** Canonical trope ordering for deterministic selectedCandidate rendering. */
const TROPE_ORDER: CoyoteTrope[] = CANONICAL_TROPE_ORDER
const CANONICAL_TROPE_CHAIN_LABEL = CANONICAL_TROPE_ORDER.join(' -> ')

export type BuildNarrativeBeatPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    combined: CombineCandidateOutputReturn
    planSelectOutput: PlanSelectOutput
}

const NARRATIVE_BEAT_INTRO = [
    'You are completing the structured phase plan and player-facing hypothesis for a Coyote-vs-Road-Runner cartoon setup.',
    '',
    '## Perspective guardrail (hard constraint)',
    '- Plan and describe trope beats strictly from the Coyote\'s planning perspective for the committed maneuver.',
    '- Treat the Coyote as the sole planner/actor and the Road Runner as the target; do not frame beats as Road Runner goal fulfillment.',
    '- If any sentence drifts into Road Runner-benefiting intent (escape optimization, trap avoidance, Coyote failure as the goal), rewrite it before output as Coyote intent, Coyote setup logic, or Coyote-side deconfliction risk handling.',
    '- Keep this guardrail inside this prompt run: enforce it while producing JSON phases, scene analysis, and final Hypothesis line without adding external deterministic phase-to-phase intent checks.',
    '',
    '## Grounding from plan selection (authoritative)',
    'The **chosen plan summary** and **plan issues** below were produced by an',
    'earlier selection step. Treat them as the committed maneuver and constraint set --- do not',
    'substitute a different plan or revert to comparing alternatives.',
    '- If a structured **selected candidate** payload is present in the grounding block, treat it as',
    '  authoritative winner detail for prop-level sequencing and role commitments.',
    '- If no structured selected-candidate payload is present, do your best with the chosen summary',
    '  plus plan issues as legacy fallback grounding.',
    '- Treat every plan issue as an actionable grounding constraint for this run.',
    '- Intent-signal issue codes (`OUTLIER_PROP_UNACCOUNTED`, `TROPE_FUNCTION_MISMATCH`,',
    '  `STRUCTURAL_CONTRADICTION`) are Coyote-side risk constraints: resolve them when possible and',
    '  escalate only if unresolved risk blocks coherent execution of the committed maneuver.',
    '- Underspecification codes (`DIRECTION_AMBIGUOUS`, `ROLE_CONFLICT`) are mandatory deconfliction',
    '  obligations: resolve them in phase planning rather than treating them as winner-selection retries.',
    '',
    '## Output order (strict)',
    '1. **First**, output **one** Markdown **` ```json ` ** fenced block whose JSON has',
    '   **exactly** top-level keys **`tropeSequence`**, **`deconflictionSummary`**, and',
    '   **`phases`**.',
    '   - **`tropeSequence`**: non-empty array of **unique** trope names; include only tropes this plan uses,',
    `     each at most once, in canonical order (${CANONICAL_TROPE_CHAIN_LABEL}). Omit tropes the maneuver does not use.`,
    '   - **`deconflictionSummary`**: concise string describing final conflict resolutions.',
    '   - **`phases`**: non-empty array, one entry per trope in `tropeSequence` at the',
    '     same index. Each phase object includes **`trope`**, **`tropeBeat`** (second-draft',
    '     beat detail), **`stableKeysUsed`**, **`virtualEntities`** (each with **`label`**,',
    '     **`derivedFrom`** string array, **`phaseKind`** gathered | synthesized |',
    '     deployed), and **`achievement`**. Optional **`prepVsBeat`**: prep | creation.',
    '   - Reference staged objects by **`stableKey`** from the snapshot / combined clustering.',
    '     When **structured plan-selection grounding** lists materialized affordance members',
    '     (**`stableKey`** values beginning with **`affordance:`**, validated like plan-select handoff),',
    '     you may cite those same strings in **`stableKeysUsed`** (they normalize in phase-plan JSON)',
    '     and in **`derivedFrom`** when grounding a virtual to that handoff-only affordance row.',
    '   - For other virtual entities, **`derivedFrom`** may cite snapshot keys, seam room labels /',
    '     topology tokens consistent with prompts, or the reserved grounding token **`setting`**',
    '     (cartoon stock affordances) where no staged row applies --- see interfaces package validators.',
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

function formatPlanSelectOutputBlock(handoff: PlanSelectOutput): string {
    const issues =
        handoff.planIssues.length > 0
            ? handoff.planIssues.map((issue) => {
                const evidence =
                    issue.evidence && issue.evidence.length > 0
                        ? `\n  - evidence: ${issue.evidence.join(' | ')}`
                        : ''
                return `- [${issue.code}] ${issue.summary}${evidence}`
            }).join('\n')
            : '- (none)'
    const selectedCandidateLines = handoff.selectedCandidate
        ? (() => {
            const selected = handoff.selectedCandidate
            const tropeAssignmentLines: string[] = []
            for (const trope of TROPE_ORDER) {
                const assignment = selected.tropeAssignments[trope]
                if (!assignment) {
                    continue
                }
                tropeAssignmentLines.push([
                    `  - trope: ${trope}`,
                    `    executionDetail: ${assignment.executionDetail}`,
                    ...assignment.members.map((member) => (
                        `    - member: ${member.stableKey} | ${member.shortName} | ${member.room} | ${member.tropeFunction}`
                    )),
                ].join('\n'))
            }
            return [
                '',
                '**Selected candidate (authoritative winner payload when present):**',
                `- candidateId: ${selected.candidateId}`,
                `- executionSummary: ${selected.executionSummary}`,
                '- tropeAssignments:',
                ...tropeAssignmentLines,
                '- outliers:',
                ...(selected.outliers.length > 0
                    ? selected.outliers.map(
                        (outlier) => `  - ${outlier.stableKey} | ${outlier.shortName} | ${outlier.room}`
                    )
                    : ['  - (none)']),
            ]
        })()
        : [
            '',
            '**Selected candidate:**',
            '- (not provided; use chosen plan summary and plan issues as fallback grounding)',
        ]
    return [
        '## Plan selection grounding',
        '',
        '**Chosen plan summary:**',
        '',
        handoff.paragraphSummary.trim(),
        '',
        '**Plan issues:**',
        issues,
        ...selectedCandidateLines,
    ].join('\n')
}

/** Option A hop 2: phase-plan JSON first, then "## Scene analysis", then fenced Hypothesis line. */
export function buildNarrativeBeatPrompt(
    input: BuildNarrativeBeatPromptInput
): CoyotePromptParts {
    const combinedMarkdown = renderCombinedCandidateOutputForNarrativeBeat(
        input.combined,
        input.roomObjectsByRoom
    )
    const seamRoomMappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const handoffBlock = formatPlanSelectOutputBlock(input.planSelectOutput)
    const invariantPrefix = [
        ...NARRATIVE_BEAT_INTRO,
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
