import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    getAffordanceRowFromDynamo,
    queryAffordanceRowsForRoom,
    type EphemeraAffordanceCacheReadDB,
} from './fetch'
import { createAffordanceCacheCacheHandler } from './factory'
import {
    canUpsertAffordanceRowAtHydrate,
    isCatalogRowStale,
    isAuthoritativeAffordanceRow,
    shouldPersistAffordanceTopologyAtHydrate,
} from './guards'
import { buildAffordanceDataCategory } from './keys'
import { createAffordanceCacheRow, type AffordanceCacheRow } from './types'

const roomId = 'ROOM#MergeTwo' as EphemeraRoomId
const perspectiveKey = 'PERSPECTIVE#v1#abc'

const readyRow = (overrides: Partial<AffordanceCacheRow> = {}): AffordanceCacheRow =>
    createAffordanceCacheRow({
        roomId,
        perspectiveKey,
        assetStack: ['ASSET#Base', 'ASSET#Personal'],
        catalogVersion: 1,
        hydratedCatalogVersion: 1,
        topology: {
            roomUniversalKey: roomId,
            exits: [
                {
                    reference: { tag: 'Room', universalKey: 'ROOM#DestEast' },
                    payload: 'East stair',
                },
            ],
        },
        ...overrides,
    })

describe('affordanceCache fetch', () => {
    it('queryAffordanceRowsForRoom filters invalid rows', async () => {
        const valid = readyRow()
        const db: EphemeraAffordanceCacheReadDB = {
            query: jest.fn().mockResolvedValue([
                valid,
                { EphemeraId: roomId, DataCategory: 'OTHER#x' },
                { EphemeraId: roomId, DataCategory: buildAffordanceDataCategory('bad'), assetStack: [] },
            ]),
            getItem: jest.fn(),
        }

        const result = await queryAffordanceRowsForRoom(db, roomId)

        expect(db.query).toHaveBeenCalledWith({
            Key: { EphemeraId: roomId },
            KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
            ExpressionAttributeValues: { ':dcPrefix': 'Affordance::' },
            allFields: true,
        })
        expect(result).toEqual([valid])
    })

    it('getAffordanceRowFromDynamo returns undefined for invalid shape', async () => {
        const db: EphemeraAffordanceCacheReadDB = {
            query: jest.fn(),
            getItem: jest.fn().mockResolvedValue({
                EphemeraId: roomId,
                DataCategory: buildAffordanceDataCategory(perspectiveKey),
            }),
        }

        const result = await getAffordanceRowFromDynamo(db, roomId, perspectiveKey)

        expect(result).toBeUndefined()
    })
})

describe('affordanceCache guards', () => {
    it('isCatalogRowStale when hydratedCatalogVersion lags catalogVersion', () => {
        expect(isCatalogRowStale(readyRow({ catalogVersion: 2, hydratedCatalogVersion: 1 }))).toBe(true)
        expect(isCatalogRowStale(readyRow())).toBe(false)
    })

    it('isAuthoritativeAffordanceRow requires hydrated catalog', () => {
        expect(isAuthoritativeAffordanceRow(readyRow())).toBe(true)
        expect(isAuthoritativeAffordanceRow(readyRow({ catalogVersion: 2, hydratedCatalogVersion: 1 }))).toBe(false)
    })

    it('canUpsertAffordanceRowAtHydrate rejects same catalog epoch', () => {
        expect(canUpsertAffordanceRowAtHydrate(1, 1)).toBe(false)
        expect(canUpsertAffordanceRowAtHydrate(undefined, 1)).toBe(true)
    })

    it('shouldPersistAffordanceTopologyAtHydrate allows first hydrate at current epoch', () => {
        const stale = readyRow({ catalogVersion: 1, hydratedCatalogVersion: 0 })
        expect(shouldPersistAffordanceTopologyAtHydrate(stale, 1)).toBe(true)
        expect(shouldPersistAffordanceTopologyAtHydrate(readyRow(), 1)).toBe(false)
        expect(shouldPersistAffordanceTopologyAtHydrate(stale, 2)).toBe(true)
        expect(shouldPersistAffordanceTopologyAtHydrate(undefined, 1)).toBe(true)
    })
})

describe('AffordanceCacheCacheHandler memo', () => {
    const makeHandler = (row: AffordanceCacheRow = readyRow()) => {
        const db: EphemeraAffordanceCacheReadDB = {
            query: jest.fn().mockResolvedValue([row]),
            getItem: jest.fn().mockResolvedValue(row),
        }
        return { handler: createAffordanceCacheCacheHandler(db), db }
    }

    it('getAffordanceRow returns hydrated row and hits memo on second call', async () => {
        const { handler, db } = makeHandler()

        const first = await handler.getAffordanceRow(roomId, perspectiveKey)
        const second = await handler.getAffordanceRow(roomId, perspectiveKey)

        expect(first).toEqual(readyRow())
        expect(second).toEqual(first)
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    //
    // The handler is a long-lived singleton cleared once per Lambda invocation, so every read after
    // the first `clear()` goes through this path; a fetched-but-unreadable store would make each
    // invocation see an empty cache no matter what Dynamo holds.
    //
    it('still returns a fetched row after clear()', async () => {
        const { handler } = makeHandler()
        await handler.getAffordanceRow(roomId, perspectiveKey)
        handler.clear()
        expect(await handler.getAffordanceRow(roomId, perspectiveKey)).toEqual(readyRow())
    })

    it('still returns fetched rows after clear()', async () => {
        const { handler } = makeHandler()
        await handler.queryAffordanceRows(roomId)
        handler.clear()
        expect(await handler.queryAffordanceRows(roomId)).toHaveLength(1)
    })

    it('getAffordanceRow returns undefined for stale row', async () => {
        const { handler } = makeHandler(readyRow({ catalogVersion: 2, hydratedCatalogVersion: 1 }))

        const result = await handler.getAffordanceRow(roomId, perspectiveKey)

        expect(result).toBeUndefined()
    })

    it('getAffordanceRowIncludingStale returns stale row', async () => {
        const stale = readyRow({ catalogVersion: 2, hydratedCatalogVersion: 1 })
        const { handler } = makeHandler(stale)

        const result = await handler.getAffordanceRowIncludingStale(roomId, perspectiveKey)

        expect(result).toEqual(stale)
    })

    it('set patches memo without Dynamo write', async () => {
        const { handler, db } = makeHandler()
        const updated = readyRow({
            topology: {
                roomUniversalKey: roomId,
                exits: [],
            },
        })

        await handler.getAffordanceRow(roomId, perspectiveKey)
        handler.set({ row: updated })

        const result = await handler.getAffordanceRow(roomId, perspectiveKey)
        expect(result?.topology.exits).toEqual([])
        expect(db.getItem).toHaveBeenCalledTimes(1)
    })

    it('invalidate clears memo for room', async () => {
        const { handler, db } = makeHandler()

        await handler.getAffordanceRow(roomId, perspectiveKey)
        handler.invalidate(roomId)
        await handler.getAffordanceRow(roomId, perspectiveKey)

        expect(db.getItem).toHaveBeenCalledTimes(2)
    })
})
