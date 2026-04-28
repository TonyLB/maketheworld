import type { BuildHypothesisPromptInput, CoyotePromptParts } from './buildHypothesisPrompt'
import type { CoyoteTrope } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
    SNAPSHOT_SECTION_HEADER,
    splitCoyoteHypothesisLinesAtSnapshot,
} from './coyoteHypothesisPromptShared'
import { formatCoyoteStagedObjectsByRoom } from '../../../utilities/coyoteRoomObjectSnapshot'

const STAGE_ONE_INTRO_LINES = [
    'You are clustering staged Acme objects in a Coyote-vs-Road-Runner cartoon setup.',
    '',
    'Reply with **valid JSON only**, following the contract below.',
    '- Do **not** write "Hypothesis:".',
    '- Do **not** use "## Scene analysis" — that belongs to a later processing step.',
    '- Your entire response must be **one JSON object** (optional ```json fence).',
    '  No Markdown headings or prose outside JSON.',
    '- After any optional fence, the payload must start with **`{`** immediately.',
    '  Do **not** emit the bare word **`json`** before **`{`** (that is not valid JSON).',
] as const

const TROPE_ORDER: CoyoteTrope[] = ['Contraption', 'Distraction', 'Disadvantage', 'Finishing Move']
const TROPE_ORDER_LABEL = TROPE_ORDER.join(' -> ')

/** Few-shot: trope-first candidate assignments with optional intendedRole compatibility echoes. */
const STAGE_ONE_JSON_FEW_SHOT = `Example (shape — use real **stableKey** strings from **Current staged objects by room** below):
\`\`\`json
{
  "candidates": [
    {
      "candidateId": "candidate-1",
      "executionSummary": "Use birdseed to lure Road Runner into lane and drop a rocket-assisted anvil strike.",
      "tropeAssignments": [
        {
          "trope": "Distraction",
          "executionDetail": "Road Runner follows the birdseed trail into the strike lane.",
          "members": [{ "stableKey": "birdseed", "intendedRole": { "role": "influence-road-runner" } }]
        },
        {
          "trope": "Finishing Move",
          "executionDetail": "Rocket skates deliver the terminal drop timing for the anvil payload.",
          "members": [{ "stableKey": "rocket-skates", "intendedRole": { "role": "delivery" } }]
        }
      ],
      "outliers": [{ "stableKey": "glue", "intendedRole": { "role": "connect-props" } }]
    }
  ],
  "notes": "Optional spatial note — emit last."
}
\`\`\`
`

const STAGE_ONE_JSON_CONTRACT_LINES = [
    '## Stage one JSON contract',
    '- Root object keys (**emit in this order — `candidates`, then optional `notes` last**):',
    '  - **`candidates`** (required non-empty array): each element is one complete',
    '    trope-first plan candidate. Each candidate object has:',
    '    - **`candidateId`** (required string): deterministic short id (for example',
    '      `candidate-1`, `candidate-2`).',
    '    - **`executionSummary`** (required non-empty string): one concise line for',
    '      the candidate\'s provisional execution.',
    '    - **`tropeAssignments`** (required non-empty array): assignments in trope',
    `      order (**${TROPE_ORDER_LABEL}**) with no duplicate trope labels per candidate.`,
    '      Each assignment object has:',
    '      - **`trope`** (required): one of `Contraption`, `Distraction`,',
    '        `Disadvantage`, `Finishing Move`.',
    '      - **`executionDetail`** (required non-empty string): first-draft detail',
    '        for how this trope beat runs in this candidate.',
    '      - **`members`** (required non-empty array): staged objects grouped to that',
    '        trope beat. Each member object has:',
    '      - **`stableKey`** (string): **literal copy** of the **`stableKey`** field',
    '        from **Current staged objects by room** (identify objects **only** by this',
    '        token — never substitute **`shortName`** or room labels).',
    '      - **`intendedRole`** (object, optional compatibility/debug echo only):',
    '        when that staged row lists **`affinities`**, echo exactly one persisted',
    '        role by value as',
    '        `{ "role": "<stored-role>" }` (no aptness, no decomposition).',
    '    - **`outliers`** (optional array): omit to require every staged object to',
    '      appear in **`tropeAssignments[*].members`** only. When present, list every',
    '      staged object that is not assigned to a trope in this candidate — each',
    '      entry has **`stableKey`** (string) and',
    '    optional **`intendedRole`** (same echo rules as cluster members; omit',
    '    **`intendedRole`** when affinities are missing or failed).',
    '    **`outliers`** must partition staged **`stableKey`**s for that candidate',
    '    (no overlap, no omissions).',
    '  - **`notes`** (optional string, **last property in the root object**): at most',
    '    one short paragraph for spatial / cross-room context only',
    '    (no forward-looking plan narrative). Emit **`notes` after `candidates`**',
    '    so cross-room framing reflects the candidate assignments you already committed to.',
    '- **Trope-first candidate grouping only.** Assign props to trope beats for each',
    '  candidate; do not collapse multiple trope beats into one unlabeled cluster.',
    '- **Omit** **`intendedRole`** when `affinities` are missing or marked failed for',
    '  that row (do not invent roles).',
    '- **Coverage per candidate:** Each staged **`stableKey`** appears **exactly once**',
    '  across candidate **`tropeAssignments[*].members`** ∪ candidate **`outliers`**',
    '  (when candidate **`outliers`** is omitted, all keys appear in',
    '  **`tropeAssignments[*].members`**).',
    '- **Strict keys:** root object may contain only **`candidates`** and optional',
    '  **`notes`**. Candidate objects may contain only **`candidateId`**,',
    '  **`executionSummary`**, **`tropeAssignments`**, and optional **`outliers`**.',
    '  Trope assignment objects may contain only **`trope`**, **`executionDetail`**,',
    '  and **`members`**. Member/outlier objects may contain only **`stableKey`** and',
    '  optional **`intendedRole`**.',
    '- **`intendedRole.role`** must match one stored affinity role for that exact',
    '  staged object: flat modification tags, **`prep`** / **`creation`**, or',
    '  structural roles. Do not include legacy tuple keys such as **`target`**',
    '  or **`mode`**.',
] as const

function stageOnePromptLines(snapshotSection: string): string[] {
    return [
        ...STAGE_ONE_INTRO_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...STAGE_ONE_JSON_CONTRACT_LINES,
        '',
        STAGE_ONE_JSON_FEW_SHOT,
        '',
        SNAPSHOT_SECTION_HEADER,
        snapshotSection || '(none)',
    ]
}

/** Stage 1 only: emits JSON clustering seam. Cache split before staged-objects snapshot. */
export function buildHypothesisStageOnePromptParts(input: BuildHypothesisPromptInput): CoyotePromptParts {
    const snapshotSection = formatCoyoteStagedObjectsByRoom(input.roomObjectsByRoom)
    const lines = stageOnePromptLines(snapshotSection)
    const splitAt = splitCoyoteHypothesisLinesAtSnapshot(lines)
    const mappingBlock = coyoteSeamRoomMappingLines(input.roomObjectsByRoom).join('\n')
    const tailAfterSplit = lines.slice(splitAt).join('\n')
    return {
        invariantPrefix: lines.slice(0, splitAt).join('\n'),
        dynamicSuffix: `\n${mappingBlock}\n\n${tailAfterSplit}`,
    }
}
