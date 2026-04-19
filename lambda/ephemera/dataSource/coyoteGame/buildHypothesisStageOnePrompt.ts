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
    '- Your entire response must be parsable seam output (optional Notes, required Objects and Clusters).',
] as const

const ACTOR_AFFINITIES_LINES = [
    '## Actor affinities',
    '- The Coyote is a physical participant in plans: he wears, rides, and operates equipment himself.',
    '- Objects requiring sustained intentional operation (vehicles, wearables, aimed or steered devices) have Coyote-affinity: they belong to him and he uses them.',
    '- Objects that work passively or trigger on contact (trip-wires, fake signs, painted tunnels, dropped weights) have Road-Runner-trap-affinity.',
    '- The Road Runner is fast but passive. He does not operate machinery or steer devices. Plans that require him to do so are probably misread.',
    '- Bait and consumables are ambiguous; treat them as context-dependent.',
] as const

const SEAM_CONTRACT_LINES = [
    '## Seam Markdown contract',
    '- Optional **## Notes**: at most one short paragraph for spatial / cross-room context.',
    '- Required **## Objects**: one ### heading per staged object, **`### {short seam label} · {shortName}`** with separator **` · `**. Use the **Seam room labels** table below (preferred).',
    '- Under each object heading, exactly two bullets in order: `- **Function:** …` then `- **Affinity:** …` with affinity token exactly one of: coyoteOperated, roadRunnerTrap, ambiguous.',
    '- Required **## Clusters**: exactly one or two cluster subsections. Each cluster starts with `### {label}` then exactly three bullets: `- **Members:**` (semicolon-separated list of **`{short seam label} · shortName`** refs, same form as object headings), `- **Coyote role:**` with token participant, trapSetter, or ambiguous, and `- **Summary:**` with one sentence.',
    '- Every **Members** reference must match an object heading. Object headings must cover exactly the multiset of staged objects below.',
] as const

function stageOnePromptLines(snapshotSection: string): string[] {
    return [
        ...STAGE_ONE_INTRO_LINES,
        '',
        ...COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES,
        '',
        ...COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES,
        '',
        ...ACTOR_AFFINITIES_LINES,
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
