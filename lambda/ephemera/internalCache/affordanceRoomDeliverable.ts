/**
 * Affordance-channel room header compose memo for terminal perception publish.
 * Stack source: AffordanceCache row at the supplied perspectiveKey (not CharacterMeta).
 */
import type { ComponentAggregateMergedCache } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import { aggregatePerspectiveExplicit } from '@tonylb/mtw-gateways/ts/assets/components/aggregate'
import type { AffordanceCacheData } from './affordanceCache'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { EphemeraObjectId, EphemeraRoomId, IMPROVISATION_ASSET_ID } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { appendImprovisationToPerspective } from '@tonylb/mtw-interfaces/ts/perspective'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardRoomData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/room'
import { shortNameToJSON } from '@tonylb/mtw-wml/ts/standardize/components/shortNameField'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { getRoomCharacterList } from './hydrateRoomRoster'
import { roomCharacterListToStandardCharacterData } from './roomWireMergeHelpers'
import type { EphemeraLudicGraph } from '../dataSource/positions/ludicGraph'

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
    getPositionGraph: (roomId: EphemeraRoomId) => Promise<EphemeraLudicGraph>
    getImprovisationObject: (objectId: EphemeraObjectId) => Promise<{ component?: StandardComponent }>
}

/**
 * Per-invocation compose memo keyed by (roomId, perspectiveKey): builds affordance-channel
 * room header StandardForm (shortName via ComponentAggregate, exits via AffordanceCache,
 * roster via graph, objects via positionGraph + improvisation merge). Called from perception on Affordances Pertain only.
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
        const [affordanceRow, roomCharacterList, positionGraph] = await Promise.all([
            this._affordanceCache.getAffordanceRow(roomId, perspectiveKey),
            getRoomCharacterList(roomId),
            this._objectReads.getPositionGraph(roomId),
        ])

        if (affordanceRow === undefined) {
            throw new Error(
                `AFFORDANCE_TOPOLOGY_NOT_READY: ${roomId} at ${perspectiveKey} (call ensureAffordanceTopology first)`
            )
        }

        const objectIds = [...positionGraph.objectIds]
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

        const objectWireRows = await Promise.all(objectIds.map(async (objectId) => {
            const pairRow = await this._objectReads.getImprovisationObject(objectId)
            const component = pairRow?.component
            const shortName = component instanceof StandardObject && component.shortName
                ? shortNameToJSON(component.shortName)
                : undefined
            return typeof shortName === 'string'
                ? { uuid: objectId, shortName }
                : undefined
        }))

        const exits = affordanceRow.topology.exits
        const shortNameLiteral = mergedRoom.shortName

        const roomRow: StandardRoomData = {
            tag: 'Room',
            universalKey: roomId,
            ...(exits.length ? { exits } : {}),
            characters: roomCharacterList.map((char) => char.EphemeraId),
            shortName: shortNameLiteral?.toJSON(),
            ...(objectWireRows.some((row) => row !== undefined)
                ? { objects: objectWireRows.filter((row): row is { uuid: typeof objectIds[number]; shortName: string } => row !== undefined) }
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
