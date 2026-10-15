/**
 * Affordance-channel room header compose memo for terminal perception publish.
 * Stack source: AffordanceCache row at the supplied perspectiveKey (not CharacterMeta).
 */
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { AffordanceCacheData } from './affordanceCache'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { appendImprovisationToPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import { getRoomCharacterList, hydrateRoomRosterFromCharacterIds } from './hydrateRoomRoster'
import { roomCharacterListToStandardCharacterData } from './roomWireMergeHelpers'
import type { StandardObjectData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/object'
import type { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'
import type { RoomObjectsRead } from '../dataSource/positions/ludicCache/roomObjectContents'

/** Cache key for AffordanceRoomDeliverable (roomId, perspectiveKey). */
export function generateAffordanceRoomDeliverableCacheKey(
    roomId: EphemeraRoomId,
    perspectiveKey: string
): string {
    return `${roomId}::${perspectiveKey}`
}

/** True if `cacheKey` is an affordance deliverable key for `roomId` (prefix match). */
export function affordanceRoomDeliverableCacheKeyForRoom(cacheKey: string, roomId: EphemeraRoomId): boolean {
    return cacheKey.startsWith(`${roomId}::`)
}

export type AffordanceRoomDeliverableObjectReads = {
    /** The room-level objects and one level of contents each, read forward from `ludicCache` (`ludicCacheRoomObjectContents`). */
    getRoomObjectContents: (
        roomId: EphemeraRoomId,
        assetStack: readonly string[]
    ) => Promise<RoomObjectsRead>
}

/**
 * Per-invocation compose memo keyed by (roomId, perspectiveKey): builds affordance-channel
 * room header StandardForm (shortName via ComponentAggregate, exits via AffordanceCache,
 * roster via the room roster, room-level objects and the wire ludicGraph from ludicCache, each object with one level of contents). Called from perception on Affordances Pertain only.
 */
export class AffordanceRoomDeliverableData {
    _componentAggregate: ComponentAggregateMergedCache
    _affordanceCache: AffordanceCacheData
    _getMetaRoom: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    _objectReads: AffordanceRoomDeliverableObjectReads
    _Cache: DeferredCache<StandardForm>
    _Store: Record<string, StandardForm> = {}

    constructor(
        componentAggregate: ComponentAggregateMergedCache,
        affordanceCache: AffordanceCacheData,
        getMetaRoom: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>,
        objectReads: AffordanceRoomDeliverableObjectReads
    ) {
        this._componentAggregate = componentAggregate
        this._affordanceCache = affordanceCache
        this._getMetaRoom = getMetaRoom
        this._objectReads = objectReads
        this._Cache = new DeferredCache<StandardForm>({
            callback: (key, description) => {
                this._Store[key] = description
            },
        })
    }

    async flush() {
        await this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
        this._Store = {}
    }

    invalidate(roomId: EphemeraRoomId): void {
        const matches = (key: string) => affordanceRoomDeliverableCacheKeyForRoom(key, roomId)
        this._Cache.invalidateWhere(matches)
        for (const key of Object.keys(this._Store)) {
            if (matches(key)) {
                delete this._Store[key]
            }
        }
    }

    async _getPromiseFactory(
        roomId: EphemeraRoomId,
        perspectiveKey: string
    ): Promise<StandardForm> {
        const affordanceRow = await this._affordanceCache.getAffordanceRow(roomId, perspectiveKey)

        if (affordanceRow === undefined) {
            throw new Error(
                `AFFORDANCE_TOPOLOGY_NOT_READY: ${roomId} at ${perspectiveKey} (call ensureAffordanceTopology first)`
            )
        }

        // The structural rows (cache, and the characters row for the roster) travel in one `getItems`, so the header reads no `Meta::Room`.
        // A missing or incomplete characters row comes back without a roster: `getRoomCharacterList` then rebuilds it.
        const { objectIds, objects: roomObjects, characterIds } = await this._objectReads.getRoomObjectContents(roomId, affordanceRow.assetStack)
        const roomCharacterList = await (characterIds ? hydrateRoomRosterFromCharacterIds(characterIds) : getRoomCharacterList(roomId))
        const mergeParticipationOrder = appendImprovisationToPerspective(
            affordanceRow.assetStack,
            objectIds
        )

        const perspective = aggregatePerspectiveExplicit({
            universalKey: roomId,
            mergeParticipationOrder,
        })

        const aggregateResults = await this._componentAggregate.get([perspective])

        const mergedRoom = aggregateResults[0]?.merged
        if (!(mergedRoom instanceof StandardRoom)) {
            throw new Error(`ComponentAggregate did not return StandardRoom for ${roomId}`)
        }

        const roomLevelIds = new Set<string>(roomObjects.map(({ objectId }) => objectId))
        // Look-path shape: the object's contents are bare references in its own `ludicGraph`, and each content's
        // name travels as a sibling stub (a content that is also room-level keeps its one room-level stub).
        const objectComponents: StandardObjectData[] = roomObjects.map(({ objectId, shortName, contents }) => ({
            tag: 'Object',
            universalKey: objectId,
            shortName,
            ...(contents.length
                ? { ludicGraph: { rootId: objectId as unknown as StandardReferenceData, nodes: [objectId, ...contents.map(({ objectId }) => objectId)] as unknown as StandardReferenceData[] } }
                : {}),
        }))
        const contentComponents: StandardObjectData[] = roomObjects
            .flatMap(({ contents }) => contents)
            .filter(({ objectId }, index, all) => !roomLevelIds.has(objectId) && all.findIndex((other) => other.objectId === objectId) === index)
            .map(({ objectId, shortName }) => ({ tag: 'Object', universalKey: objectId, shortName }))

        const exits = affordanceRow.topology.exits
        const shortNameLiteral = mergedRoom.shortName

        const roomRow: StandardRoomData = {
            tag: 'Room',
            universalKey: roomId,
            ...(exits.length ? { exits } : {}),
            characters: roomCharacterList.map((char) => char.EphemeraId),
            shortName: shortNameLiteral?.toJSON(),
            // The client reads only the room's Object refs, in order, so the wire graph is projected from the cache read (BS-7).
            ...(roomObjects.length
                ? { ludicGraph: { rootId: roomId as unknown as StandardReferenceData, nodes: [roomId, ...roomObjects.map(({ objectId }) => objectId)] as unknown as StandardReferenceData[] } }
                : {}),
        }

        const characterComponents = roomCharacterListToStandardCharacterData(roomCharacterList)

        return new StandardForm(
            [
                { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
                roomRow,
                ...characterComponents,
                ...objectComponents,
                ...contentComponents,
            ],
            { standardizeMode: 'ephemeraWire' }
        )
    }

    async get(roomId: EphemeraRoomId, perspectiveKey: string): Promise<StandardForm> {
        const cacheKey = generateAffordanceRoomDeliverableCacheKey(roomId, perspectiveKey)
        if (!this._Cache.isCached(cacheKey)) {
            this._Cache.add({
                promiseFactory: async () => this._getPromiseFactory(roomId, perspectiveKey),
                requiredKeys: [cacheKey],
                transform: (fetch) => {
                    if (typeof fetch === 'undefined') {
                        return {}
                    }
                    return {
                        [cacheKey]: fetch,
                    }
                },
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }
}

export default AffordanceRoomDeliverableData
