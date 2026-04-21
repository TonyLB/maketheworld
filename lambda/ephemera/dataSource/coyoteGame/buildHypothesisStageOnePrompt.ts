import type { BuildHypothesisPromptInput, CoyotePromptParts } from './buildHypothesisPrompt'
import {
    COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
    COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
    coyoteSeamRoomMappingLines,
    SNAPSHOT_SECTION_HEADER,
    splitCoyoteHypothesisLinesAtSnapshot,
} from './coyoteHypothesisPromptShared'
import { formatCoyoteStagedObjectsByRoom } from './coyoteRoomObjectSnapshot'

const STAGE_ONE_INTRO_LINES = [
    'You are clustering staged Acme objects in a Coyote-vs-Road-Runner cartoon setup.',
    '',
    'Reply with **valid JSON only**, following the contract below.',
    '- Do **not** write "Hypothesis:".',
    '- Do **not** use "## Scene analysis" — that belongs to a later processing step.',
    '- Your entire response must be **one JSON object** (optional ```json fence). No Markdown headings or prose outside JSON.',
    '- After any optional fence, the payload must start with **`{`** immediately. Do **not** emit the bare word **`json`** before **`{`** (that is not valid JSON).',
] as const

/** Few-shot: **intendedRole** echoes one flat **role** only (no tuple fields, no aptness). */
const STAGE_ONE_JSON_FEW_SHOT = `Example (shape — use real **stableKey** strings from **Current staged objects by room** below):
\`\`\`json
{
  "clusters": [
    {
      "clusterName": "Trap setup",
      "members": [
        { "stableKey": "birdseed", "intendedRole": { "role": "influence-road-runner" } },
        { "stableKey": "glue", "intendedRole": { "role": "prep" } }
      ]
    }
  ],
  "outliers": [
    { "stableKey": "anvil", "intendedRole": { "role": "terminal" } }
  ],
  "notes": "Optional spatial note — emit last."
}
\`\`\`
`

const STAGE_ONE_JSON_CONTRACT_LINES = [
    '## Stage one JSON contract',
    '- Root object keys (**emit in this order — `clusters`, then optional `outliers`, then optional `notes` last**):',
    '  - **`clusters`** (required non-empty array): upper bound **one cluster per staged object**. Each element has:',
    '    - **`clusterName`** (string): short human-readable label for a **functional/thematic** group.',
    '    - **`members`** (required non-empty array): objects that belong together in that cluster. Each member object has:',
    '      - **`stableKey`** (string): **literal copy** of the **`stableKey`** field from **Current staged objects by room** (identify objects **only** by this token — never substitute **`shortName`** or room labels).',
    '      - **`intendedRole`** (object): when that staged row lists **`affinities`**, you must echo **one** persisted **`CoyoteAffinityPossibility`** (same shape as in enrich), excluding aptness that is most applicable to the cluster context.',
    '  - **`outliers`** (optional array): omit to require every staged object to appear in **`clusters`** only. When present, list every staged object that does not belong to a cluster — each entry has **`stableKey`** (string) and optional **`intendedRole`** (same echo rules as cluster members; omit **`intendedRole`** when affinities are missing or failed). **`clusters`** and **`outliers`** must partition staged **`stableKey`**s (no overlap, no omissions).',
    '  - **`notes`** (optional string, **last property in the root object**): at most one short paragraph for spatial / cross-room context only (no forward-looking plan narrative). Emit **`notes` after `clusters`** (and after **`outliers`** when used) so cross-room framing reflects the clustering you already committed to.',
    '- **Functional/thematic clustering only.** Group props that work together toward one maneuver. Do **not** encode temporal ordering or beat sequencing here.',
    '- **Omit** **`intendedRole`** when `affinities` are missing or marked failed for that row (do not invent roles).',
    '- **Coverage:** Each staged **`stableKey`** appears **exactly once** across **`clusters`** ∪ **`outliers`** (when **`outliers`** is omitted, all keys appear only in **`clusters`**).',
    '- Prefer flat modification tags + **`prep`** / **`creation`** / structural roles consistent with Acme enrich; do not include tuple fields like **`target`** or **`mode`** in **`intendedRole`**.',
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
