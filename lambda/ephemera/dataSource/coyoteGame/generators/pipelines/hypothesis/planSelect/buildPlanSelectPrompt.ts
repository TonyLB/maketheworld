import type { CoyotePromptParts } from '../promptTypes'
import type { CombineCandidateOutputReturn } from '../candidates/combineCandidateOutput'
import { serializePlanSelectCandidateInput } from '../candidates/combineCandidateOutput'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
} from '../coyoteHypothesisPromptShared'
import { PLAN_SELECT_OUTPUT_JSON_KEYS } from './parsePlanSelectOutput'
import type { CoyoteRoomObjectsByRoom } from '../../../../utilities/coyoteRoomObjectSnapshot'

export type BuildPlanSelectPromptInput = {
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
    combined: CombineCandidateOutputReturn
}

/** How to read the fenced JSON trope-candidates block in the dynamic tail. */
const PLAN_SELECT_COMBINED_JSON_SCHEMA_LINES = [
    '## Trope candidates JSON (input; how to read)',
    '- The **` ```json ` ** block in the dynamic section is **input only**: it is the complete,',
    '  authoritative list of **Stage One candidates** after parse and combine. **Schema version 3**',
    '  root keys: **`schemaVersion`**, **`candidates`**.',
    '- **`candidates`** is the exhaustive option set. You must **only** compare, score, and select',
    '  among these rows. **Do not** invent alternative plans, extra candidates, or substitute',
    '  paraphrases for new option ids.',
    '- Each candidate has **`candidateId`**, **`executionSummary`**, **`tropeAssignments`**, and **`outliers`**.',
    '- **`tropeAssignments`** is a **non-array object keyed by trope name** (allowed keys:',
    '  **`Contraption`**, **`Distraction`**, **`Disadvantage`**, **`Finishing Move`**); only present',
    '  tropes appear as keys. Each value carries **`executionDetail`** (Stage One first-draft beat',
    '  detail) and **`members`**. Each member has **`stableKey`**, **`shortName`**, **`room`** (seam',
    '  label without the `ROOM#` prefix when known), and **`tropeFunction`** (that prop\'s',
    '  trope-local job in this candidate). Members may also include optional **`environmentAffordances`**:',
    '  an array of **`{ "object": <catalog scene object>, "roles": CoyoteTrope[] }`** from staged',
    '  object metadata (scene dependencies). Members may also include optional **`affordancesProvided`**:',
    '  an array of **`{ "object": string, "intended"?: true, "roles": CoyoteTrope[] }`** from staged',
    '  object metadata (explicit provided-affordance evidence for that prop).',
    '- **`outliers`** lists staged props not placed under any trope row for that candidate (server-derived),',
    '  each with **`stableKey`**, **`shortName`**, and **`room`** only (no **`tropeFunction`** on outliers),',
    '  and the same optional **`environmentAffordances`** / **`affordancesProvided`** shapes when present',
    '  on the staged object.',
    '- **`executionSummary`** states how that candidate frames the overall maneuver; member **`tropeFunction`**',
    '  lines label each in-trope prop\'s intent. Use both when judging coherence and intent-fit; treat',
    '  outliers as membership evidence (which props are outside named trope beats in this candidate).',
] as const

const PLAN_SELECTION_READING_RULES = [
    '## Reading the setup',
    '- Address the player in second person ("you") when describing what a plan would do.',
    '- Treat each **candidate** as one complete Coyote setup and maneuver path aimed at the Road Runner.',
    '- Use **stableKey**, **shortName**, and **room** from the JSON as ground truth for which prop is',
    '  where; use **tropeFunction** and **executionDetail** for how that candidate uses each in-trope prop.',
    '- When **`environmentAffordances`** appears on a member or outlier row, treat it as authored scene',
    '  dependency signal from staged metadata (what nearby terrain or catalog environment supports the beat).',
    '- When **`affordancesProvided`** appears on a member or outlier row, treat it as authored evidence',
    '  of what that staged prop is intended to supply; it complements **tropeFunction** but does not',
    '  replace it.',
    '- **Outliers** in the JSON are candidate-local: eligible props outside named trope rows for that',
    '  candidate only.',
] as const

const PLAN_SELECTION_INTERNAL_PHASES_MULTI_CANDIDATE = [
    '## Internal phase order (single invocation; structured internals)',
    '- Keep one response, but execute these internal phases in order before finalizing output.',
    '- These phase artifacts are internal scaffolding for consistency and should not override output-format constraints.',
    '- The only downstream-consumed artifact is the final trailing handoff `json` fence.',
    '',
    '### Phase 1 - candidate audit (internal mini-schema)',
    '- Build an internal `candidateAudit` array where each row is:',
    '  `{ "candidateId": string, "coverage": string, "completeness": string, "coherence": string, "issues": string[] }`.',
    '- Include exactly one row per input candidate, in input order.',
    '',
    '### Phase 2 - rubric judgment (internal mini-schema)',
    '- Build an internal `rubricJudgment` object:',
    '  `{ "candidateOrder": string[], "comparisons": { "<candidateId>": { "coverage": string, "completeness": string, "coherence": string } }, "tieBreak": string | null }`.',
    '- Use this structure to support exactly one rubric sentence per candidate in the required markdown section.',
    '',
    '### Phase 3 - winner merge and residual issues (internal mini-schema)',
    '- Build an internal `winnerMerge` object:',
    '  `{ "winnerCandidateId": string, "paragraphSummaryDraft": string, "residualPlanIssues": { "code": string, "summary": string, "evidence"?: string[] }[] }`.',
    '- Keep only residual unresolved issues in `residualPlanIssues`; do not carry forward resolved rows.',
    '',
    '### Phase 4 - final handoff emission',
    '- Emit required markdown sections in order, then emit the final handoff `json` fence as the last fence in the response.',
    '- Ensure handoff JSON preserves required key types for `paragraphSummary` and `planIssues`.',
    '- Include `selectedCandidate` in the final handoff JSON as a full copy of the winning candidate row',
    '  (`candidateId`, `executionSummary`, `tropeAssignments`, `outliers`) from the input candidates JSON.',
    '  **`tropeAssignments`** in `selectedCandidate` must remain a **non-array object keyed by trope**',
    '  (matching the input shape); do **not** rewrite it as an array.',
] as const

const PLAN_SELECTION_INTERNAL_PHASES_SINGLE_CANDIDATE = [
    '## Internal phase order (single invocation; structured internals)',
    '- Keep one response, but execute these internal phases in order before finalizing output.',
    '- These phase artifacts are internal scaffolding for consistency and should not override output-format constraints.',
    '- The only downstream-consumed artifact is the final trailing handoff `json` fence.',
    '',
    '### Phase 1 - issue surfacing for the sole candidate (internal mini-schema)',
    '- Build an internal `singleCandidateIssueAudit` object:',
    '  `{ "candidateId": string, "intentConflicts": string[], "residualPlanIssues": { "code": string, "summary": string, "evidence"?: string[] }[] }`.',
    '- Keep only residual unresolved issues in `residualPlanIssues`; do not carry forward resolved rows.',
    '',
    '### Phase 2 - candidate enhancement and final handoff emission',
    '- Build an internal `singleCandidateDelivery` object:',
    '  `{ "winnerCandidateId": string, "paragraphSummaryDraft": string, "selectedCandidate": object }`.',
    '- Emit required markdown sections in order, then emit the final handoff `json` fence as the last fence in the response.',
    '- Ensure handoff JSON preserves required key types for `paragraphSummary` and `planIssues`.',
    '- Include `selectedCandidate` in the final handoff JSON as a full copy of the winning candidate row',
    '  (`candidateId`, `executionSummary`, `tropeAssignments`, `outliers`) from the input candidates JSON.',
    '  **`tropeAssignments`** in `selectedCandidate` must remain a **non-array object keyed by trope**',
    '  (matching the input shape); do **not** rewrite it as an array.',
] as const

const PLAN_SELECTION_TWO_JSON_FENCES_SECTION = [
    '## Two JSON fences (critical)',
    '- The **` ```json ` ** block in the **dynamic section below** (after seam rooms) is **input data**',
    '  --- read-only trope candidates.',
    '- Your reply must **end** with a **separate** **` ```json ` ** fenced block (language tag **json**)',
    '  containing the hop handoff keys --- that trailing fence is **your output**, not part of the',
    '  setup.',
] as const

const PLAN_SELECTION_TASK_COMMON_SECTION_AND_HANDOFF = [
    '- Do **not** invent or rewrite candidate plans. Do not introduce props, rooms, trope beats,',
    '  or causal steps that are absent from the selected candidate\'s JSON fields.',
    '- Then emit exactly these Markdown sections in order:',
    '  1. **`## Intent conflicts`** --- list only evidence that the candidate may misread player',
    '     intent. Eligible: unaccounted staged props, affordance contradictions, **mismatches',
    '     between a member prop\'s `tropeFunction` and how the candidate uses that prop in `executionSummary`',
    '     or trope rows**, props central to the summary that never appear in members or outliers, and',
    '     topology issues for Road Runner positioning. Exclude execution risks, missing mechanisms, and',
    '     generic "might miss" failure concerns.',
    '- End your reply with **only** a Markdown **` ```json ` ** fenced block (language tag **json**)',
    '  containing at least these required keys: **`',
    PLAN_SELECT_OUTPUT_JSON_KEYS.paragraphSummary,
    '`** (string: a restatement of the chosen candidate only; must start with `Selected',
    '  <candidateId>:` and stay anchored to that candidate\'s `executionSummary` plus listed',
    '  trope/member evidence --- no new plan steps) and **`',
    PLAN_SELECT_OUTPUT_JSON_KEYS.planIssues,
    '`** (array of objects: each issue row must include **`code`** and **`summary`**, and may include',
    '  optional **`evidence`** as a string array. Allowed `code` values: `OUTLIER_PROP_UNACCOUNTED`,',
    '  `TROPE_FUNCTION_MISMATCH`, `STRUCTURAL_CONTRADICTION`, `DIRECTION_AMBIGUOUS`, `ROLE_CONFLICT`.',
    '  Code semantics for v1: `OUTLIER_PROP_UNACCOUNTED`, `TROPE_FUNCTION_MISMATCH`, and',
    '  `STRUCTURAL_CONTRADICTION` are intent-signal evidence that should count against the winner in',
    '  your selection judgment; `DIRECTION_AMBIGUOUS` and `ROLE_CONFLICT` are underspecification',
    '  obligations for downstream deconfliction and are not automatic winner disqualifiers by',
    '  themselves.',
    '  Include **`',
    PLAN_SELECT_OUTPUT_JSON_KEYS.selectedCandidate,
    '`** as a complete copy of the winning candidate row from input JSON',
    '  (`candidateId`, `executionSummary`, `tropeAssignments`, `outliers`). **`tropeAssignments`**',
    '  must be the same **non-array object keyed by trope** that appears in the input row; do **not**',
    '  reshape it as an array.',
    '  Treat this field as required output for this prompt run; do not omit it unless generating it is impossible.',
    '  Additional keys are allowed, but these two keys must be present and well-typed.',
    '- The **final** **` ```json ` ** block in your entire output must be this **handoff** fence ---',
    '  the **last** fence in your output.',
] as const

const PLAN_SELECTION_INTRO_MULTI_CANDIDATE = [
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
    ...PLAN_SELECTION_TWO_JSON_FENCES_SECTION,
    '',
    '## Task',
    '- Ground yourself briefly on the setup (at most one sentence before required sections).',
    '- Compare **all listed candidates** under **coverage**, **completeness**, and **coherence** using',
    '  **`candidateId`**, **`executionSummary`**, member **`tropeFunction`**, **`executionDetail`**, **`stableKey`**,',
    '  **`shortName`**, **`room`**, optional **`environmentAffordances`** / **`affordancesProvided`**, and',
    '  outlier membership as evidence.',
    '- In **`## Rubric comparison`**, write exactly one sentence per candidate in the same order as',
    '  input JSON. Every sentence must begin with **`candidateId`** (for example,',
    '  `candidate-2:`) and must stay grounded in that candidate\'s fields only.',
    '- Treat **coverage**, **completeness**, and **coherence** as **equally important** when judging',
    '  candidates. Do not emphasize one dimension over another in prose or tie-break language.',
    '- Do **not** grade or bias candidates on Road Runner safety, villain effectiveness, or outcome',
    '  comedy --- those belong to later execution prompts, not this rubric.',
    ...PLAN_SELECTION_TASK_COMMON_SECTION_AND_HANDOFF,
    '  2. **`## Rubric comparison`** --- exactly one sentence per candidate, each sentence prefixed',
    '     by that sentence\'s **`candidateId`**.',
    '  3. **`## Winner selection`** --- select exactly one best **candidate** by **`candidateId`** and',
    '     explain why using only winner-field evidence.',
    '- In **`## Winner selection`**, pick exactly **one** winning **`candidateId`** with no ties unless you',
    '  apply an explicit tie-break stated in one line (prefer avoiding ties).',
    '- The first line in **`## Winner selection`** must be exactly: **`Winner: <candidateId>`**.',
] as const

const PLAN_SELECTION_INTRO_SINGLE_CANDIDATE = [
    'You are **reviewing and refining** a single provided Coyote-vs-Road-Runner maneuver candidate',
    '(JSON below) before the detailed hypothesis is written. There is no candidate-to-candidate',
    'competition in this run.',
    '',
    '## Perspective guardrail (hard constraint)',
    '- Evaluate and describe the candidate strictly from the Coyote\'s planning perspective.',
    '- Treat the Coyote as the sole planner and actor selecting maneuvers; the Road Runner is the',
    '  target to be affected by those maneuvers.',
    '- Describe this candidate as Coyote setup, intent, and Coyote-side failure-risk analysis where',
    '  relevant to unresolved issues.',
    '',
    ...PLAN_SELECTION_TWO_JSON_FENCES_SECTION,
    '',
    '## Task',
    '- Ground yourself briefly on the setup (at most one sentence before required sections).',
    '- Surface unresolved intent and structural issues using **`candidateId`**, **`executionSummary`**,',
    '  member **`tropeFunction`**, **`executionDetail`**, **`stableKey`**, **`shortName`**, **`room`**, optional',
    '  **`environmentAffordances`** / **`affordancesProvided`**, and outlier membership as evidence.',
    '- In **`## Rubric comparison`**, write exactly one short sentence prefixed with the sole',
    '  **`candidateId`** (for example, `candidate-1:`). Keep it non-comparative and grounded only in',
    '  that candidate\'s fields.',
    ...PLAN_SELECTION_TASK_COMMON_SECTION_AND_HANDOFF,
    '  2. **`## Rubric comparison`** --- exactly one sentence prefixed by the sole **`candidateId`**.',
    '  3. **`## Winner selection`** --- select the sole **candidate** by **`candidateId`** and explain',
    '     why using only that candidate\'s field evidence.',
    '- In **`## Winner selection`**, the first line must be exactly: **`Winner: <candidateId>`**.',
] as const

export function buildPlanSelectPrompt(
    input: BuildPlanSelectPromptInput
): CoyotePromptParts {
    const isSingleCandidate = input.combined.candidates.length === 1
    const seamRoomMappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const tropeCandidatesJson = serializePlanSelectCandidateInput(input.combined, input.roomObjectsByRoom)
    const intro = isSingleCandidate
        ? PLAN_SELECTION_INTRO_SINGLE_CANDIDATE
        : PLAN_SELECTION_INTRO_MULTI_CANDIDATE
    const internalPhases = isSingleCandidate
        ? PLAN_SELECTION_INTERNAL_PHASES_SINGLE_CANDIDATE
        : PLAN_SELECTION_INTERNAL_PHASES_MULTI_CANDIDATE
    const invariantPrefix = [
        ...intro,
        '',
        '## Rubric dimensions',
        '- **coverage** --- how much each staged prop / affordance can contribute to the plan.',
        '- **completeness** --- how much everything **needed** by the plan is already present or',
        '  constructable from staged props and topology (including synthesis implied by the plan).',
        '- **coherence** --- how well implied actions reinforce each other toward one maneuver.',
        '',
        ...PLAN_SELECT_COMBINED_JSON_SCHEMA_LINES,
        '',
        ...internalPhases,
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
