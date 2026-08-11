import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'

import internalCache from '../../../internalCache'
import { seamRoomLabelFromEphemeraRoomId } from '../generators/pipelines/hypothesis/coyoteHypothesisPromptShared'

/** Stitched Coyote staged object (graph placement + Meta::Object + improvisation shortName). */
export type CoyoteStagedObject = {
    objectId: EphemeraObjectId;
    shortName: string;
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}

export type CoyoteRoomObjectSnapshotDeps = {
    getGameRooms: () => Promise<string[]>
    getObjectIdsInRoom: (roomId: EphemeraRoomId) => Promise<EphemeraObjectId[]>
    getStagedObject: (objectId: EphemeraObjectId) => Promise<CoyoteStagedObject | undefined>
}

/** Staged objects by room for Coyote hypothesis/outcome prompts. */
export type CoyoteRoomObjectsByRoom = Record<EphemeraRoomId, CoyoteStagedObject[]>

const defaultGetObjectIdsInRoom = async (roomId: EphemeraRoomId): Promise<EphemeraObjectId[]> => {
    const graph = await internalCache.Positions.getLudicGraph(roomId)
    return [...graph.objectIds]
}

const defaultGetStagedObject = async (objectId: EphemeraObjectId): Promise<CoyoteStagedObject | undefined> => {
    const [meta, pairRow] = await Promise.all([
        internalCache.ObjectEphemeraMeta.get(objectId),
        internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID),
    ])
    if (!meta) {
        return undefined
    }
    const component = pairRow?.component
    const rawShortName = component instanceof StandardObject && component.shortName
        ? shortNameToJSON(component.shortName)
        : undefined
    const shortName = typeof rawShortName === 'string' ? rawShortName : ''
    return {
        objectId,
        shortName,
        stableKey: meta.stableKey,
        ...(meta.tropeAffinities !== undefined ? { tropeAffinities: meta.tropeAffinities } : {}),
        ...(meta.tropeAffinitiesFailed === true ? { tropeAffinitiesFailed: true } : {}),
    }
}

export async function loadCoyoteRoomObjectsByRoom(
    deps: CoyoteRoomObjectSnapshotDeps
): Promise<CoyoteRoomObjectsByRoom> {
    const roomKeys = await deps.getGameRooms()
    const roomIds = roomKeys.map((roomKey): EphemeraRoomId => `ROOM#${roomKey}`)
    const roomObjectLists = await Promise.all(
        roomIds.map(async (roomId) => {
            const objectIds = await deps.getObjectIdsInRoom(roomId)
            const staged = await Promise.all(objectIds.map((objectId) => deps.getStagedObject(objectId)))
            return {
                roomId,
                objects: staged.filter((entry): entry is CoyoteStagedObject => entry !== undefined),
            }
        })
    )

    return Object.fromEntries(
        roomObjectLists.map(({ roomId, objects }) => [roomId, objects])
    ) as CoyoteRoomObjectsByRoom
}

function formatRoomLabel(roomId: EphemeraRoomId): string {
    return seamRoomLabelFromEphemeraRoomId(roomId)
}

function sortedRoomEntries(
    roomObjectsByRoom: CoyoteRoomObjectsByRoom
): [EphemeraRoomId, CoyoteStagedObject[]][] {
    return (Object.entries(roomObjectsByRoom) as [EphemeraRoomId, CoyoteStagedObject[]][])
        .sort(([a], [b]) => (a as string).localeCompare(b as string))
}

/** Renders trope-affinity lines for one staged object. */
export function formatCoyoteObjectAffinitySuffix(o: CoyoteStagedObject): string {
    const parts: string[] = []
    if (o.tropeAffinities && o.tropeAffinities.length > 0) {
        parts.push(`tropes: ${o.tropeAffinities.map((entry) => (
            `${entry.trope} ${entry.aptness} (${entry.narrowing})`
        )).join('; ')}`)
    }
    else if (o.tropeAffinitiesFailed === true) {
        parts.push('trope affinities unavailable (enrich failed)')
    }
    return parts.join(' | ')
}

function formatCoyoteStagedObjectLine(o: CoyoteStagedObject): string {
    const suffix = formatCoyoteObjectAffinitySuffix(o)
    const keyPart = ` — stableKey: ${o.stableKey}`
    if (suffix) {
        return `${o.shortName}${keyPart} — ${suffix}`
    }
    return `${o.shortName}${keyPart}`
}

/** Shared "staged objects by room" block for Coyote prompts (hypothesis, plan outcome). */
export function formatCoyoteStagedObjectsByRoom(roomObjectsByRoom: CoyoteRoomObjectsByRoom): string {
    const entries = sortedRoomEntries(roomObjectsByRoom)
    const blocks = entries.map(([roomId, objects]) => {
        const label = formatRoomLabel(roomId)
        if (objects.length === 0) {
            return `${label}: (none)`
        }
        const lines = objects.map(formatCoyoteStagedObjectLine)
        return `${label}:\n${lines.map((line) => `  ${line}`).join('\n')}`
    })
    const snapshotSection = blocks.join('\n')
    return snapshotSection || '(none)'
}

export const createDefaultCoyoteRoomObjectSnapshotDeps = (): CoyoteRoomObjectSnapshotDeps => ({
    getGameRooms: () => internalCache.CoyoteGame.get('gameRooms'),
    getObjectIdsInRoom: defaultGetObjectIdsInRoom,
    getStagedObject: defaultGetStagedObject,
})
