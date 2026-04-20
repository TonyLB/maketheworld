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
    'Reply with structured Markdown **only**, following the seam contract below.',
    '- Do **not** write "Hypothesis:".',
    '- Do **not** use "## Scene analysis" — that belongs to a later processing step.',
    '- Your entire response must be parsable seam output: optional **## Notes**, then required **## Clusters** (no **## Objects** section).',
] as const

const SEAM_CONTRACT_LINES = [
    '## Seam Markdown contract',
    '- **Functional/thematic clustering only.** Group props that work together toward one maneuver. Do **not** encode temporal ordering or beat sequencing here; that belongs to later plan-phase narration.',
    '- Optional **## Notes**: at most one short paragraph for spatial / cross-room context only (no forward-looking plan narrative).',
    '- Required **## Clusters**: one **or more** cluster subsections (upper bound: one subsection per staged object). Each subsection starts with `### {cluster label}` (short human-readable label only).',
    '- Under each cluster heading, list **every member object** assigned to that cluster using **exactly one block per staged object**, in this order:',
    '  - First line for that member: `- **stableKey:** ` followed by that object\'s **`stableKey`** token as shown in **Current staged objects by room** (literal copy).',
    '  - Optionally, when the staged object rows include plan-role **`affinities`**, you may cite **one** persisted role choice by emitting a fenced **`json`** block immediately after that member\'s **`stableKey`** line. The fence opens with **` ```json`** on its own line, contains **exactly one** JSON object shaped like **`CoyoteAffinityPossibility`** (`terminal` | `trigger` | `delivery` | `autonomous_agent` | `prep` | `creation` | `entity_modification` with `target`/`mode`), including **`aptness`** copied from the staged row you select. Close with **` ``` **` on its own line.',
    '- **Omit** the fenced JSON block entirely when `affinities` are missing or marked failed for that row (do not invent roles).',
    '- **Coverage:** Each staged **`stableKey`** across all rooms must appear **exactly once** across all clusters (every object is in precisely one functional cluster).',
    '- Prefer selecting **`prep`** / **`creation`** / **`entity_modification`** / structural roles consistent with definitions in Acme enrich; do not treat **`prep`** as chronological "first beat" clustering.',
] as const

function stageOnePromptLines(snapshotSection: string): string[] {
    return [
        ...STAGE_ONE_INTRO_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...SEAM_CONTRACT_LINES,
        '',
        SNAPSHOT_SECTION_HEADER,
        snapshotSection || '(none)',
    ]
}

/** Stage 1 only: emits structured Markdown seam (clustering). Cache split before staged-objects snapshot. */
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
