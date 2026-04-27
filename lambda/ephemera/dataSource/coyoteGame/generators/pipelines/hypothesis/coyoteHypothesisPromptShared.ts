/**
 * Prompt fragments shared between hypothesis stage 1 (seam clustering) and stage 2
 * (scene analysis + Hypothesis line). Imported from both builders so topology stays
 * identical across round-trips.
 */

import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/**
 * Seam text uses short room labels (topology-style) while the snapshot uses canonical
 * `ROOM#…` ids. Labels are derived from ids for now (`ROOM#` stripped); mapping may later
 * use human-readable titles while staying one row per id.
 */
export function seamRoomLabelFromEphemeraRoomId(roomId: EphemeraRoomId): string {
    const id = roomId as string
    if (id.startsWith('ROOM#')) {
        return id.slice('ROOM#'.length)
    }
    return id
}

/** Normalizes headings / member refs: optional `ROOM#` prefix may be omitted in the seam. */
export function normalizeSeamRoomLabelToken(token: string): string {
    const t = token.trim()
    if (t.startsWith('ROOM#')) {
        return t.slice('ROOM#'.length)
    }
    return t
}

function roomIdsWithStagedObjects(
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): EphemeraRoomId[] {
    return (Object.entries(roomObjectsByRoom) as [EphemeraRoomId, EphemeraMetaRoomObject[]][])
        .filter(([, objects]) => objects.length > 0)
        .map(([rid]) => rid)
        .sort((a, b) => (a as string).localeCompare(b as string))
}

/**
 * Prompt lines: table of `ROOM#…` → short seam label. Place in both stage-1 and stage-2 prompts
 * (dynamic region; varies with which rooms hold objects).
 */
export function coyoteSeamRoomMappingLines(
    roomObjectsByRoom: Record<EphemeraRoomId, EphemeraMetaRoomObject[]>
): string[] {
    const roomIds = roomIdsWithStagedObjects(roomObjectsByRoom)
    const lines: string[] = [
        '## Seam room labels',
        '- Canonical **`EphemeraRoomId`** values appear only in **Current staged objects by room**. Stage One JSON **`members`** reference objects **only** by **`stableKey`** from that snapshot — not by **`shortName`**, room headings, or this label table.',
        '- Right now each short label is the **`ROOM#` prefix stripped** from the id. Later we may substitute friendlier names; this table stays the source of truth for interpreting geography vs ids.',
        '- Use topology / room flavor in **`notes`** or free-text **`clusterName`** when helpful; spatial reasoning must not replace **`stableKey`** identifiers in **`members`**.',
        '',
    ]
    for (const rid of roomIds) {
        const label = seamRoomLabelFromEphemeraRoomId(rid)
        lines.push(`- \`${rid}\` → **${label}**`)
    }
    return lines
}

/** Snapshot heading for staged-object lines (hypothesis prompts; matches legacy buildHypothesisPrompt). */
export const SNAPSHOT_SECTION_HEADER = '## Current staged objects by room'

/** Line-by-line topology (with ## heading) — spread into prompt line arrays for cache-split alignment. */
export const COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES = [
    '## World topology',
    '- STRAIGHTAWAY is west of VORTEX. It is a long desert highway lined with cacti, stretching toward the western horizon.',
    '- VORTEX is the starting room. The highway passes the base of a tall, sheer cliff here.',
    '- CLIFFTOP is directly above VORTEX. A boulder sits near the cliff edge.',
    '- CORNER is east of VORTEX. The road continues east, then turns sharply south, bending away from a rock face.',
    '- BRIDGE is south of CORNER. It is a bridge over a yawning chasm, carrying the road north-south.',
] as const

/** Line-by-line cartoon opportunity cues — spread into prompt line arrays. */
export const COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES = [
    '## Cartoon opportunity points',
    '- Objects placed on CLIFFTOP may imply a plan to drop or release the boulder onto the road below at VORTEX.',
    '- Objects placed near CORNER may imply a plan for the Road Runner to collide with the rock face, overshoot the turn, or be redirected by the bend in the road.',
    '- Objects placed on BRIDGE may imply a collapse, a fake crossing, a trap over the chasm, or a break in the road.',
    '- Objects placed on STRAIGHTAWAY may imply a chase setup, acceleration, bait, or a long run-up.',
    '- Read object placement spatially. Room choice matters, not just the object names.',
] as const

/** Full topology block including heading (matches prior monolithic hypothesis prompt). */
export const COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_SECTION = COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_LINES.join('\n')

/** Cartoon geography cues block including heading (matches prior monolithic hypothesis prompt). */
export const COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_SECTION = COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES.join('\n')

/** Concatenates topology and opportunity sections with the same spacing as [`buildHypothesisPrompt.ts`] before refactoring. */
export function coyoteHypothesisSharedWorldContextBlock(): string {
    return `${COYOTE_HYPOTHESIS_WORLD_TOPOLOGY_SECTION}\n\n${COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_SECTION}`
}

/** Blank line immediately before [`SNAPSHOT_SECTION_HEADER`] marks the Bedrock prompt-cache boundary. */
export function splitCoyoteHypothesisLinesAtSnapshot(lines: string[]): number {
    const splitAt = lines.findIndex(
        (line, index) => line === '' && lines[index + 1] === SNAPSHOT_SECTION_HEADER
    )
    if (splitAt < 0) {
        throw new Error('Coyote hypothesis prompt: missing blank line before staged-objects snapshot')
    }
    return splitAt
}
