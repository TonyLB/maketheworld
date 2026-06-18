import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { CoyoteTropeAffinity } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { EphemeraMetaObject, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { ephemeraDB, exponentialBackoffWrapper } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { RoomKey } from '@tonylb/mtw-utilities/ts/types'

import internalCache from '../../internalCache'
import { collectObjectIdsFromPositionGraph } from './collectObjectIdsFromRoomPositionGraphs'
import { invalidateImprovisationObjectCaches } from './invalidateImprovisationObjectCaches'

const META_OBJECT_DATA_CATEGORY = 'Meta::Object' as const

/** Dynamo transact limit; each object delete uses two Delete items. */
const MAX_OBJECTS_PER_DELETE_TRANSACT = 12

export type SpawnImprovisationObjectArgs = {
    objectId: EphemeraObjectId;
    shortName: string;
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
    affectedRoomIds?: EphemeraRoomId[];
}

export type UpdateImprovisationObjectArgs = {
    objectId: EphemeraObjectId;
    shortName?: string;
    stableKey?: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
    affectedRoomIds?: EphemeraRoomId[];
}

export type DeleteImprovisationObjectArgs = {
    objectId: EphemeraObjectId;
    affectedRoomIds?: EphemeraRoomId[];
}

export type ClearCoyoteGameImprovisationObjectsArgs = {
    getGameRooms?: () => Promise<string[]>;
    getRoomPositionGraph?: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>;
}

export type PersistImprovisationObjectDependencies = {
    transactWrite?: typeof ephemeraDB.transactWrite;
    getMetaObject?: (objectId: EphemeraObjectId) => Promise<EphemeraMetaObject | undefined>;
    getImprovisationPair?: (objectId: EphemeraObjectId) => Promise<StandardObject | undefined>;
}

const pairRowFromShortName = (objectId: EphemeraObjectId, shortName: string) => ({
    EphemeraId: objectId,
    DataCategory: IMPROVISATION_ASSET_ID,
    tag: 'Object' as const,
    shortName,
})

export const improvisationPairPutItem = (objectId: EphemeraObjectId, shortName: string) => ({
    Put: pairRowFromShortName(objectId, shortName),
})

const metaRowFromArgs = (args: {
    objectId: EphemeraObjectId;
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}): EphemeraMetaObject => ({
    EphemeraId: args.objectId,
    DataCategory: META_OBJECT_DATA_CATEGORY,
    stableKey: args.stableKey,
    ...(args.tropeAffinities !== undefined ? { tropeAffinities: args.tropeAffinities } : {}),
    ...(args.tropeAffinitiesFailed === true ? { tropeAffinitiesFailed: true as const } : {}),
})

export const metaObjectPutItem = (args: {
    objectId: EphemeraObjectId;
    stableKey: string;
    tropeAffinities?: CoyoteTropeAffinity[];
    tropeAffinitiesFailed?: boolean;
}) => ({
    Put: metaRowFromArgs(args),
})

const deleteTransactItemsForObject = (objectId: EphemeraObjectId) => [
    {
        Delete: {
            EphemeraId: objectId,
            DataCategory: IMPROVISATION_ASSET_ID,
        },
    },
    {
        Delete: {
            EphemeraId: objectId,
            DataCategory: META_OBJECT_DATA_CATEGORY,
        },
    },
]

const defaultGetMetaObject = async (objectId: EphemeraObjectId): Promise<EphemeraMetaObject | undefined> =>
    internalCache.ObjectEphemeraMeta.get(objectId)

const defaultGetImprovisationPair = async (objectId: EphemeraObjectId): Promise<StandardObject | undefined> => {
    const row = await internalCache.ImprovisationComponentData.get(objectId, IMPROVISATION_ASSET_ID)
    return row.component instanceof StandardObject ? row.component : undefined
}

/**
 * Atomically create improvisation pair + Meta::Object rows for a new OBJECT#.
 */
export const persistSpawnImprovisationObject = async (
    args: SpawnImprovisationObjectArgs,
    deps?: PersistImprovisationObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId } | { ok: false; errorMessage: string }> => {
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)
    const metaRow = metaRowFromArgs(args)

    if (!isEphemeraMetaObject(metaRow)) {
        return { ok: false, errorMessage: `Invalid Meta::Object payload for ${args.objectId}` }
    }

    try {
        await transactWrite([
            improvisationPairPutItem(args.objectId, args.shortName),
            metaObjectPutItem(args),
        ])

        const component = new StandardObject({
            tag: 'Object',
            universalKey: args.objectId,
            shortName: args.shortName,
        })
        invalidateImprovisationObjectCaches({
            objectId: args.objectId,
            affectedRoomIds: args.affectedRoomIds,
            pairComponent: component,
            metaRow,
        })

        return { ok: true, objectId: args.objectId }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorMessage: message }
    }
}

/**
 * Update improvisation pair body and/or Meta::Object fields in one transact.
 */
export const persistUpdateImprovisationObject = async (
    args: UpdateImprovisationObjectArgs,
    deps?: PersistImprovisationObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId } | { ok: false; errorMessage: string }> => {
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)
    const getMetaObject = deps?.getMetaObject ?? defaultGetMetaObject
    const getImprovisationPair = deps?.getImprovisationPair ?? defaultGetImprovisationPair

    const priorMeta = await getMetaObject(args.objectId)
    const priorPair = await getImprovisationPair(args.objectId)

    if (!priorMeta || !priorPair) {
        return { ok: false, errorMessage: `Improvisation rows not found for ${args.objectId}` }
    }

    const nextShortName = args.shortName ?? (priorPair.toJSON().shortName as string | undefined) ?? ''
    const nextMeta = metaRowFromArgs({
        objectId: args.objectId,
        stableKey: args.stableKey ?? priorMeta.stableKey,
        tropeAffinities: args.tropeAffinities !== undefined ? args.tropeAffinities : priorMeta.tropeAffinities,
        tropeAffinitiesFailed: args.tropeAffinitiesFailed !== undefined
            ? args.tropeAffinitiesFailed
            : priorMeta.tropeAffinitiesFailed,
    })

    if (!isEphemeraMetaObject(nextMeta)) {
        return { ok: false, errorMessage: `Invalid Meta::Object payload for ${args.objectId}` }
    }

    try {
        await transactWrite([
            { Put: pairRowFromShortName(args.objectId, nextShortName) },
            { Put: nextMeta },
        ])

        const component = new StandardObject({
            tag: 'Object',
            universalKey: args.objectId,
            shortName: nextShortName,
        })
        invalidateImprovisationObjectCaches({
            objectId: args.objectId,
            affectedRoomIds: args.affectedRoomIds,
            pairComponent: component,
            metaRow: nextMeta,
        })

        return { ok: true, objectId: args.objectId }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorMessage: message }
    }
}

/**
 * Delete both improvisation rows for one OBJECT#.
 */
export const persistDeleteImprovisationObject = async (
    args: DeleteImprovisationObjectArgs,
    deps?: PersistImprovisationObjectDependencies
): Promise<{ ok: true; objectId: EphemeraObjectId } | { ok: false; errorMessage: string }> => {
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)

    try {
        await transactWrite(deleteTransactItemsForObject(args.objectId))
        invalidateImprovisationObjectCaches({
            objectId: args.objectId,
            affectedRoomIds: args.affectedRoomIds,
        })
        return { ok: true, objectId: args.objectId }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorMessage: message }
    }
}

const defaultGetRoomPositionGraph = async (roomId: EphemeraRoomId) =>
    internalCache.ComponentEphemeraMeta.get(roomId)

/**
 * Coyote-scoped bulk delete: enumerate OBJECT# ids from stored positionGraph on game rooms,
 * then delete pair + Meta::Object rows. Does not mutate graphs (Phase 4 placement).
 */
export const persistClearCoyoteGameImprovisationObjects = async (
    args: ClearCoyoteGameImprovisationObjectsArgs = {},
    deps?: PersistImprovisationObjectDependencies
): Promise<{ ok: true; deletedObjectIds: EphemeraObjectId[]; affectedRoomIds: EphemeraRoomId[] } | { ok: false; errorMessage: string }> => {
    const transactWrite = deps?.transactWrite ?? ephemeraDB.transactWrite.bind(ephemeraDB)
    const getGameRooms = args.getGameRooms ?? (() => internalCache.CoyoteGame.get('gameRooms'))
    const getRoomPositionGraph = args.getRoomPositionGraph ?? defaultGetRoomPositionGraph

    try {
        const gameRooms = await getGameRooms()
        const affectedRoomIds = gameRooms.map((room) => RoomKey(room) as EphemeraRoomId)
        const objectIdSet = new Set<EphemeraObjectId>()

        for (const roomId of affectedRoomIds) {
            const meta = await getRoomPositionGraph(roomId)
            for (const objectId of collectObjectIdsFromPositionGraph(meta?.positionGraph)) {
                objectIdSet.add(objectId)
            }
        }

        const objectIds = [...objectIdSet]
        if (objectIds.length === 0) {
            return { ok: true, deletedObjectIds: [], affectedRoomIds }
        }

        for (let offset = 0; offset < objectIds.length; offset += MAX_OBJECTS_PER_DELETE_TRANSACT) {
            const chunk = objectIds.slice(offset, offset + MAX_OBJECTS_PER_DELETE_TRANSACT)
            const transactItems = chunk.flatMap((objectId) => deleteTransactItemsForObject(objectId))
            await exponentialBackoffWrapper(async () => {
                await transactWrite(transactItems)
            }, { retryErrors: ['TransactionCanceledException'] })
        }

        for (const objectId of objectIds) {
            invalidateImprovisationObjectCaches({
                objectId,
                affectedRoomIds,
            })
        }

        return { ok: true, deletedObjectIds: objectIds, affectedRoomIds }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return { ok: false, errorMessage: message }
    }
}
