/**
 * Affordance-channel room header compose memo for terminal perception publish.
 * Stack source: AffordanceCache row at the supplied perspectiveKey (not CharacterMeta).
 */
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { AffordanceCacheData } from './affordanceCache'
import type { PositionsData } from './positions'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import type { RoomCharacterListItem } from './baseClasses'
import { playPositionRosterEntryToRoomCharacterListItem } from './hydrateRoomRoster'
import { roomCharacterListToStandardCharacterData } from './roomWireMergeHelpers'

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

/**
 * Per-invocation compose memo keyed by (roomId, perspectiveKey): builds affordance-channel
 * room header StandardForm (shortName via ComponentAggregate, exits via AffordanceCache,
 * roster/objects via ephemera meta). Called from perception on Affordances Pertain only.
 */
export class AffordanceRoomDeliverableData {
    _componentAggregate: ComponentAggregateMergedCache
    _affordanceCache: AffordanceCacheData
    _positions: PositionsData
    _getMetaRoom: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    _Cache: DeferredCache<StandardForm>
    _Store: Record<string, StandardForm> = {}

    constructor(
        componentAggregate: ComponentAggregateMergedCache,
        affordanceCache: AffordanceCacheData,
        positions: PositionsData,
        getMetaRoom: (roomId: EphemeraRoomId) => Promise<EphemeraMetaRoom | undefined>
    ) {
        this._componentAggregate = componentAggregate
        this._affordanceCache = affordanceCache
        this._positions = positions
        this._getMetaRoom = getMetaRoom
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
        const [affordanceRow, rosterEntries, meta] = await Promise.all([
            this._affordanceCache.getAffordanceRow(roomId, perspectiveKey),
            this._positions.getRoomRoster(roomId),
            this._getMetaRoom(roomId),
        ])
        const roomCharacterList: RoomCharacterListItem[] = rosterEntries.map(
            playPositionRosterEntryToRoomCharacterListItem
        )

        if (affordanceRow === undefined) {
            throw new Error(
                `AFFORDANCE_TOPOLOGY_NOT_READY: ${roomId} at ${perspectiveKey} (call ensureAffordanceTopology first)`
            )
        }

        const perspective = aggregatePerspectiveExplicit({
            universalKey: roomId,
            mergeParticipationOrder: affordanceRow.assetStack,
        })

        const aggregateResults = await this._componentAggregate.get([perspective])

        const mergedRoom = aggregateResults[0]?.merged
        if (!(mergedRoom instanceof StandardRoom)) {
            throw new Error(`ComponentAggregate did not return StandardRoom for ${roomId}`)
        }

        const exits = affordanceRow.topology.exits
        const shortNameLiteral = mergedRoom.shortName

        const roomRow: StandardRoomData = {
            tag: 'Room',
            universalKey: roomId,
            ...(exits.length ? { exits } : {}),
            characters: roomCharacterList.map((char) => char.EphemeraId),
            shortName: shortNameLiteral?.toJSON(),
            ...(meta?.objects?.length
                ? {
                    objects: meta.objects.map((o) => ({ uuid: o.uuid, shortName: o.shortName })),
                }
                : {}),
        }

        const characterComponents = roomCharacterListToStandardCharacterData(roomCharacterList)

        return new StandardForm(
            [
                { tag: 'Asset', universalKey: 'ASSET#render', key: 'render' },
                roomRow,
                ...characterComponents,
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
