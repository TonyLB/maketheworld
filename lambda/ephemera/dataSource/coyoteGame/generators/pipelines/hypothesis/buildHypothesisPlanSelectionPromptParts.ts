import type { CoyotePromptParts } from './buildHypothesisPrompt'
import type { CombineHypothesisClustersReturn } from './combineHypothesisClusters'
import { serializePlanSelectCombinedInput } from './combineHypothesisClusters'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
} from './coyoteHypothesisPromptShared'
import { COYOTE_HOP1_HANDOFF_JSON_KEYS } from './coyoteHop1Handoff'
import type { CoyoteRoomObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

export type BuildHypothesisPlanSelectionPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    combined: CombineHypothesisClustersReturn
}

/** How to read the fenced JSON trope-candidates block in the dynamic tail. */
const PLAN_SELECT_COMBINED_JSON_SCHEMA_LINES = [
    '## Trope candidates JSON (input; how to read)',
    '- The **` ```json ` ** block in the dynamic section is **input only**: it is the complete,',
    '  authoritative list of **Stage One candidates** after parse and combine. **Schema version 1**',
    '  root keys: **`schemaVersion`**, **`candidates`**.',
    '- **`candidates`** is the exhaustive option set. You must **only** compare, score, and select',
    '  among these rows. **Do not** invent alternative plans, extra candidates, or substitute',
    '  paraphrases for new option ids.',
    '- Each candidate has **`candidateId`**, **`executionSummary`**, **`tropeAssignments`**, and **`outliers`**.',
    '- Each **`tropeAssignment`** has **`trope`**, **`executionDetail`** (Stage One first-draft beat detail),',
    '  and **`members`**. Each member has **`stableKey`**, **`shortName`**, **`room`** (seam label without',
    '  the `ROOM#` prefix when known), and **`tropeFunction`** (that prop\'s trope-local job in this',
    '  candidate).',
    '- **`outliers`** lists staged props assigned outside trope sections for that candidate, each',
    '  with the same **`stableKey`** / **`shortName`** / **`room`** / **`tropeFunction`** shape.',
    '- **`executionSummary`** states how that candidate frames the overall maneuver; **`tropeFunction`**',
    '  lines label each staged prop\'s intent inside that candidate. Use both when judging coherence',
    '  and intent-fit.',
] as const

const PLAN_SELECTION_READING_RULES = [
    '## Reading the setup',
    '- Address the player in second person ("you") when describing what a plan would do.',
    '- Treat each **candidate** as one complete Coyote setup and maneuver path aimed at the Road Runner.',
    '- Use **stableKey**, **shortName**, and **room** from the JSON as ground truth for which prop is',
    '  where; use **tropeFunction** and **executionDetail** for how that candidate uses each prop.',
    '- **Outliers** in the JSON are candidate-local: eligible props outside named trope rows for that',
    '  candidate only.',
] as const

const PLAN_SELECTION_INTRO = [
    'You are **selecting** the best high-level Coyote-vs-Road-Runner maneuver from a **fixed list of',
    'candidates** (JSON below) before the detailed hypothesis is written. You are not asked to draft',
    'new candidate plans from scratch.',
    '',
    '## Perspective guardrail (hard constraint)',
    '- Evaluate and describe every candidate strictly from the Coyote\'s planning perspective.',
    '- Treat the Coyote as the sole planner and actor selecting maneuvers; the Road Runner is the',
    '  target to be affected by those maneuvers.',
    '- Describe each candidate as Coyote setup, intent, and Coyote-side failure-risk analysis where',
    '  relevant to the rubric.',
    '- Winner rationale should explain why the selected **provided candidate** best serves the',
    '  Coyote\'s maneuver.',
    '',
    '## Two JSON fences (critical)',
    '- The **` ```json ` ** block in the **dynamic section below** (after seam rooms) is **input data**',
    '  --- read-only trope candidates.',
    '- Your reply must **end** with a **separate** **` ```json ` ** fenced block (language tag **json**)',
    '  containing the hop handoff keys --- that trailing fence is **your output**, not part of the',
    '  setup.',
    '',
    '## Task',
    '- Ground yourself briefly on the setup (at most one sentence before required sections).',
    '- Compare **all listed candidates** under **coverage**, **completeness**, and **coherence** using',
    '  **`candidateId`**, **`executionSummary`**, **`tropeFunction`**, **`executionDetail`**, **`stableKey`**,',
    '  **`shortName`**, **`room`**, and outliers as evidence.',
    '- In **`## Rubric comparison`**, write exactly one sentence per candidate in the same order as',
    '  input JSON. Every sentence must begin with **`candidateId`** (for example,',
    '  `candidate-2:`) and must stay grounded in that candidate\'s fields only.',
    '- Treat **coverage**, **completeness**, and **coherence** as **equally important** when judging',
    '  candidates. Do not emphasize one dimension over another in prose or tie-break language.',
    '- Do **not** grade or bias candidates on Road Runner safety, villain effectiveness, or outcome',
    '  comedy --- those belong to later execution prompts, not this rubric.',
    '- Do **not** invent or rewrite candidate plans. Do not introduce props, rooms, trope beats,',
    '  or causal steps that are absent from the selected candidate\'s JSON fields.',
    '- Then emit exactly these Markdown sections in order:',
    '  1. **`## Intent conflicts`** --- list only evidence that the **winning** candidate may misread',
    '     player intent. Eligible: unaccounted staged props, affordance contradictions, **mismatches',
    '     between a prop\'s `tropeFunction` and how the candidate uses that prop in `executionSummary`',
    '     or trope rows**, props central to the summary that never appear in members/outliers, and',
    '     topology issues for Road Runner positioning. Exclude execution risks, missing mechanisms, and',
    '     generic "might miss" failure concerns.',
    '  2. **`## Rubric comparison`** --- exactly one sentence per candidate, each sentence prefixed',
    '     by that sentence\'s **`candidateId`**.',
    '  3. **`## Winner selection`** --- select exactly one best **candidate** by **`candidateId`** and',
    '     explain why using only winner-field evidence.',
    '- In **`## Winner selection`**, pick exactly **one** winning **`candidateId`** with no ties unless you',
    '  apply an explicit tie-break stated in one line (prefer avoiding ties).',
    '- The first line in **`## Winner selection`** must be exactly: **`Winner: <candidateId>`**.',
    '- End your reply with **only** a Markdown **` ```json ` ** fenced block (language tag **json**)',
    '  containing at least these required keys: **`',
    COYOTE_HOP1_HANDOFF_JSON_KEYS.paragraphSummary,
    '`** (string: a restatement of the chosen candidate only; must start with `Selected',
    '  <candidateId>:` and stay anchored to that candidate\'s `executionSummary` plus listed',
    '  trope/member evidence --- no new plan steps) and **`',
    COYOTE_HOP1_HANDOFF_JSON_KEYS.planIssues,
    '`** (array of objects: each issue row must include **`code`** and **`summary`**, and may include',
    '  optional **`evidence`** as a string array. Allowed `code` values: `OUTLIER_PROP_UNACCOUNTED`,',
    '  `TROPE_FUNCTION_MISMATCH`, `STRUCTURAL_CONTRADICTION`, `DIRECTION_AMBIGUOUS`, `ROLE_CONFLICT`.',
    '  Use these issue rows for evidence that the chosen candidate may misread player intent or needs',
    '  deconfliction obligations resolved downstream).',
    '  Additional keys are allowed, but these two keys must be present and well-typed.',
    '- The **final** **` ```json ` ** block in your entire output must be this **handoff** fence ---',
    '  the **last** fence in your output.',
] as const

export function buildHypothesisPlanSelectionPromptParts(
    input: BuildHypothesisPlanSelectionPromptInput
): CoyotePromptParts {
    const seamRoomMappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const tropeCandidatesJson = serializePlanSelectCombinedInput(input.combined, input.roomObjectsByRoom)
    const invariantPrefix = [
        ...PLAN_SELECTION_INTRO,
        '',
        '## Rubric dimensions',
        '- **coverage** --- how much each staged prop / affordance can contribute to the plan.',
        '- **completeness** --- how much everything **needed** by the plan is already present or',
        '  constructable from staged props and topology (including synthesis implied by the plan).',
        '- **coherence** --- how well implied actions reinforce each other toward one maneuver.',
        '',
        ...PLAN_SELECT_COMBINED_JSON_SCHEMA_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...PLAN_SELECTION_READING_RULES,
        '',
        'The following blocks are specific to this request (seam room labels, then trope candidates JSON).',
    ].join('\n')

    const dynamicSuffix = [
        '',
        seamRoomMappingBlock,
        '',
        '## Trope candidates (input JSON)',
        '',
        '```json',
        tropeCandidatesJson,
        '```',
        '',
    ].join('\n')

    return {
        invariantPrefix,
        dynamicSuffix: `\n${dynamicSuffix}`,
    }
}
