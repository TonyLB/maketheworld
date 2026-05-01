/**
 * Coyote hypothesis / outcome prompts: shared topology, seam room labels, and snapshot alignment.
 *
 * ## Room id seam (one-way contract)
 *
 * **Canonical** room identity in MTW remains `EphemeraRoomId` (for example `ROOM#VORTEX`).
 * **Prompt-facing** geography uses **seam labels** from {@link seamRoomLabelFromEphemeraRoomId}:
 * short tokens the model should reason about (for example `CLIFFBASE` for the cliff-base highway
 * under `ROOM#VORTEX`). That mapping is **one-way**: we do not resolve seam labels back to
 * `EphemeraRoomId` anywhere in this pipeline.
 *
 * **Single source of truth for overrides:** {@link COYOTE_SEAM_ROOM_LABEL_OVERRIDES}. Add new
 * Coyote-only renames there only; do not scatter ad-hoc `replace(/^ROOM#/, '')` for prompt text.
 *
 * ### If you ever need reverse mapping (`seam label` -> `EphemeraRoomId`)
 *
 * Today nothing consumes model-emitted `room` strings or phase-plan `derivedFrom` topology tokens
 * as authoritative ids. Introducing backward-reference would require, at minimum:
 *
 * - A **bijective** or explicitly primary-keyed map (overrides + default strip must not collide
 *   across two canonical ids mapping to the same label).
 * - **Legacy tokens:** {@link normalizeSeamRoomLabelToken} maps both the old strip label (`VORTEX`)
 *   and the new seam label (`CLIFFBASE`) to one normalized token for validators; a reverse map
 *   must accept the same set and fail closed on unknown strings.
 * - **Hop-1 handoff** (`selectedCandidate.members[].room` in `parsePlanSelectOutput.ts`): free strings
 *   today; reverse lookup would need strict validation vs the snapshot-derived allowlist.
 * - **Phase-plan** (`validateCoyotePhasePlan` in `packages/mtw-interfaces/ts/coyotePhasePlan.ts`):
 *   `derivedFrom` mixes snapshot `stableKey`s, reserved `setting`, and topology tokens in one
 *   allowlist; disambiguate room labels from stable keys before resolving to ids.
 * - **Tests / fixtures:** many rows assert seam labels as literals; every boundary would need
 *   canonical-id assertions again.
 * - **Multi-world scope:** overrides are process-global constants; per-asset or per-world aliases
 *   would need scoping before any reverse map is safe.
 */

import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoomObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/**
 * Coyote-only seam label overrides. Keys are canonical `EphemeraRoomId`; values are the label
 * shown in prompts, combined-clustering Markdown, JSON snapshot `room`, and phase-plan topology
 * allowlists (via {@link seamRoomLabelFromEphemeraRoomId}).
 */
export const COYOTE_SEAM_ROOM_LABEL_OVERRIDES: Partial<Record<EphemeraRoomId, string>> = {
    'ROOM#VORTEX': 'CLIFFBASE',
}

/**
 * Seam label for prompts and topology allowlists. Consult {@link COYOTE_SEAM_ROOM_LABEL_OVERRIDES}
 * first; otherwise strip the `ROOM#` prefix from the canonical id.
 */
export function seamRoomLabelFromEphemeraRoomId(roomId: EphemeraRoomId): string {
    const override = COYOTE_SEAM_ROOM_LABEL_OVERRIDES[roomId]
    if (override !== undefined && override.trim().length > 0) {
        return override.trim()
    }
    const id = roomId as string
    if (id.startsWith('ROOM#')) {
        return id.slice('ROOM#'.length)
    }
    return id
}

/**
 * Normalizes a topology / seam token for comparison with allowlisted labels.
 * Optional `ROOM#` prefix is stripped. Legacy strip label `VORTEX` and seam label `CLIFFBASE`
 * both normalize to `CLIFFBASE` when `ROOM#VORTEX` is overridden.
 */
export function normalizeSeamRoomLabelToken(token: string): string {
    let t = token.trim()
    if (t.startsWith('ROOM#')) {
        t = t.slice('ROOM#'.length)
    }
    for (const [rid, label] of Object.entries(COYOTE_SEAM_ROOM_LABEL_OVERRIDES) as [
        EphemeraRoomId,
        string,
    ][]) {
        const id = rid as string
        if (!id.startsWith('ROOM#')) {
            continue
        }
        const legacyStrip = id.slice('ROOM#'.length)
        const seam = label.trim()
        if (t === legacyStrip || t === seam) {
            return seam
        }
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
        '- Each **seam label** is the default `ROOM#` strip from the id, **unless** listed in the Coyote override map in code (`COYOTE_SEAM_ROOM_LABEL_OVERRIDES` in `coyoteHypothesisPromptShared.ts`); this table is the source of truth for interpreting geography vs ids.',
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
    '- STRAIGHTAWAY is west of CLIFFBASE. It is a long desert highway lined with cacti, stretching toward the western horizon.',
    '- CLIFFBASE is the starting room. The highway passes the base of a tall, sheer cliff here.',
    '- CLIFFTOP is directly above CLIFFBASE. A boulder sits near the cliff edge.',
    '- CORNER is east of CLIFFBASE. The road continues east, then turns sharply south, bending away from a rock face.',
    '- BRIDGE is south of CORNER. It is a bridge over a yawning chasm, carrying the road north-south.',
] as const

/** Line-by-line cartoon opportunity cues — spread into prompt line arrays. */
export const COYOTE_HYPOTHESIS_CARTOON_OPPORTUNITY_LINES = [
    '## Cartoon opportunity points',
    '- Objects placed on CLIFFTOP may imply a plan to drop or release the boulder onto the road below at CLIFFBASE.',
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
