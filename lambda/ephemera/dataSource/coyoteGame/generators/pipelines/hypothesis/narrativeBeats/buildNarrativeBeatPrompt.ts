import type { CoyotePromptParts } from '../promptTypes'
import {
    INTERPRETATION_RULES_LINES,
    TEMPORAL_ORDERING_LINES,
    VIRTUAL_SCENERY_AND_PREP_OBJECTS_LINES,
} from '../narrativePromptShared'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
} from '../coyoteHypothesisPromptShared'
import type {
    PlanSelectOutput,
    PlanSelectWinningCandidate,
} from '../planSelect/parsePlanSelectOutput'
import type { CoyoteRoomObjectsByRoom } from '../../../../utilities/coyoteRoomObjectSnapshot'
import type { CoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { CANONICAL_TROPE_ORDER } from '@tonylb/mtw-interfaces/ts/coyotePhasePlan'

/** Plan-select handoff with structured winner detail required for narrative beat grounding. */
export type PlanSelectOutputWithWinner = PlanSelectOutput & {
    selectedCandidate: PlanSelectWinningCandidate
}

/** Canonical trope ordering for deterministic selectedCandidate rendering. */
const TROPE_ORDER: CoyoteTrope[] = CANONICAL_TROPE_ORDER

export type BuildNarrativeBeatPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    planSelectOutput: PlanSelectOutputWithWinner
}

const NARRATIVE_BEAT_INTRO = [
    'You are sketching an internal beat scratchpad, then a cartoon play-by-play, then a single player-facing Hypothesis line for a Coyote-vs-Road-Runner cartoon setup.',
    '',
    '## Perspective guardrail (hard constraint)',
    '- Plan and describe beats strictly from the Coyote\'s planning perspective for the committed maneuver.',
    '- Treat the Coyote as the sole planner/actor and the Road Runner as the target; do not frame beats as Road Runner goal fulfillment.',
    '- If any sentence drifts into Road Runner-benefiting intent (escape optimization, trap avoidance, Coyote failure as the goal), rewrite it before output as Coyote intent, Coyote setup logic, or Coyote-side risk handling.',
    '- Keep this guardrail inside this prompt run: enforce it while producing JSON scratchpad, **## Cartoon play-by-play**, and final Hypothesis line without adding external deterministic phase-to-phase intent checks.',
    '',
    '## Grounding from plan selection (authoritative)',
    'The **chosen plan summary**, **plan issues**, and **structured selected candidate** in **## Committed plan** below were produced by an',
    'earlier selection step. Treat them as the committed maneuver and constraint set --- do not',
    'substitute a different plan or revert to comparing alternatives.',
    '- The **selected candidate** payload is authoritative winner detail for prop-level sequencing and role commitments.',
    '- Treat every plan issue as an actionable grounding constraint for this run.',
    '- Intent-signal issue codes (`OUTLIER_PROP_UNACCOUNTED`, `TROPE_FUNCTION_MISMATCH`,',
    '  `STRUCTURAL_CONTRADICTION`) are Coyote-side risk constraints: resolve them when possible and',
    '  escalate only if unresolved risk blocks coherent execution of the committed maneuver.',
    '- Underspecification codes (`DIRECTION_AMBIGUOUS`, `ROLE_CONFLICT`) bind how you **narrate** the committed maneuver:',
    '  commit to concrete timeline and role choices in the scratchpad JSON and in **## Cartoon play-by-play**.',
    '  Do **not** re-run winner-level rubric comparison; plan selection already chose the reading.',
    '',
    '## Output order (strict)',
    '1. **First**, output **one** Markdown **` ```json ` ** fenced block whose JSON has',
    '   **exactly** top-level keys **`beats`** and **`linearizedSequence`**.',
    '   - **`beats`**: non-empty array. Each element is a plain object with **exactly** keys **`beatId`**, **`description`**, **`derivedFrom`**.',
    '     - **`beatId`**: non-empty string, stable within this payload, unique across `beats`.',
    '     - **`description`**: non-empty string; one beat of cartoon action in present tense (internal scratchpad register is fine here).',
    '     - **`derivedFrom`**: non-empty string array. Each token must be one of:',
    '       a staged **`stableKey`** from the room snapshot or **## Committed plan**;',
    '       a materialized affordance **`stableKey`** beginning with **`affordance:`** when listed in **## Committed plan**;',
    '       a seam / topology token consistent with world topology and seam room labels in this prompt;',
    '       or the reserved token **`setting`** for cartoon stock affordances with no staged row.',
    '   - **`linearizedSequence`**: non-empty array of strings. It must list every **`beatId`** from **`beats`** exactly once (no duplicates, no omissions),',
    '     in the order the cartoon gag plays out.',
    '2. **Second**, write **`## Cartoon play-by-play`** (Markdown): imagined cartoon action for **this** plan only,',
    '   in present tense, ordered to match **`linearizedSequence`**. This is play-by-play, not engineering analysis.',
    '   Do not survey multiple plans.',
    '3. **Third**, after "## Cartoon play-by-play", output a **final** fenced block with',
    '   language **`text`** whose **only** content is exactly one plain-text line',
    '   beginning with "Hypothesis:".',
    '4. Do not put any other text after the closing **` ```text ` ** fence.',
    '5. Even if you are unsure about the JSON details, still provide a complete',
    '   "## Cartoon play-by-play" and final Hypothesis line (downstream systems can',
    '   preserve prose when structured JSON needs correction).',
    '',
    '## Cartoon play-by-play and Hypothesis output',
    '- Your "## Cartoon play-by-play" section should commit to the single reading above.',
    '- Ground it on **## Committed plan**, **## Outliers** within it, seam topology below, and staged snapshot keys.',
    '- Open **` ```text ` ** only after "## Cartoon play-by-play". The fenced interior must contain **only** the Hypothesis line.',
    '- No extra commentary outside the leading **` ```json ` ** scratchpad,',
    '  "## Cartoon play-by-play", and the fenced Hypothesis line.',
] as const

/** How to read **## Committed plan** (single winner; inlined per hypothesis narrative-beats decision 3). */
const COMMITTED_PLAN_MARKDOWN_CONTRACT_LINES = [
    '## Committed plan Markdown (how to read the grounding block)',
    '- **## Committed plan** appears in this prompt before the seam room mapping block. It is the only plan-grounding Markdown: **Chosen plan summary**, **Plan issues**, and **Selected candidate (authoritative winner payload)**. There is no **## Combined trope candidates** section, no **### Candidate** blocks, and no additional candidate pool after seam topology.',
    '- Under **tropeAssignments**, each trope lists **executionDetail** and **member** lines (**stableKey**, **shortName**, **room**, **tropeFunction**). Treat each trope block as plan-local structure; do not merge member rows across tropes.',
    '- **executionDetail** is Stage One first-draft beat detail for that trope. Member bullets list staged objects; when **## Committed plan** lists **synthetic** materialized affordance members (**`stableKey`** values beginning with **`affordance:`**), those are not snapshot rows but are authoritative when present.',
    '- **tropeFunction** on each member line describes that object\'s trope-local job; use it as the canonical annotation for in-trope role intent.',
    '- The **outliers** list under the selected candidate names props not under any trope row; role language for outliers is not fixed like trope members --- do not move outlier props into trope rows unless the handoff already assigns them there.',
] as const

const CARTOON_PLAY_BY_PLAY_AND_FENCED_HYPOTHESIS_LINES = [
    '## Cartoon play-by-play and fenced Hypothesis (assistant text only)',
    '- Put **imagined cartoon action and ordering** in "## Cartoon play-by-play" in the',
    '  assistant **text** stream (**body**). Do not rely on a separate Nova',
    '  reasoning channel.',
    '- The **final** ```text fence must contain **only** the Hypothesis line so parsers can slice it reliably.',
] as const

function formatCommittedPlanBlock(handoff: PlanSelectOutputWithWinner): string {
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
    const selectedCandidateLines = [
        '',
        '**Selected candidate (authoritative winner payload):**',
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
    return [
        '## Committed plan',
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

/** Hop 2: narrative-beats JSON scratchpad first, then "## Cartoon play-by-play", then fenced Hypothesis line. */
export function buildNarrativeBeatPrompt(
    input: BuildNarrativeBeatPromptInput
): CoyotePromptParts {
    const seamRoomMappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const committedPlanBlock = formatCommittedPlanBlock(input.planSelectOutput)
    const invariantPrefix = [
        ...NARRATIVE_BEAT_INTRO,
        '',
        ...COMMITTED_PLAN_MARKDOWN_CONTRACT_LINES,
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
        ...CARTOON_PLAY_BY_PLAY_AND_FENCED_HYPOTHESIS_LINES,
        '',
        'The following blocks are specific to this request:',
        '',
        committedPlanBlock,
    ].join('\n')

    const dynamicSuffix = [
        '',
        seamRoomMappingBlock,
        '',
    ].join('\n')

    return {
        invariantPrefix,
        dynamicSuffix: `\n${dynamicSuffix}`,
    }
}
