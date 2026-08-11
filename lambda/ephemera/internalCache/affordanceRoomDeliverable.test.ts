import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { testPositionGraph } from '../dataSource/positions/ludicGraph/testFixtures'
import internalCache from '../internalCache'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { StandardObject } from '@tonylb/mtw-wml/ts/standardize/components/object'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { mergeRoomExitsToJSON } from './roomWireMergeHelpers'
import * as hydrateRoomRosterModule from './hydrateRoomRoster'
import { createAffordanceCacheRow } from '@tonylb/mtw-gateways/ts/ephemera/affordanceCache'
import { computePerspectiveKey } from '@tonylb/mtw-interfaces/ts/perspective'

import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { ExitPayload } from '@tonylb/mtw-wml/ts/standardize/keys/facets/dataTypes/facet'
import type { FacetListData } from '@tonylb/mtw-wml/ts/standardize/keys/abstract'

const mockAffordanceRow = (
    roomId: EphemeraRoomId,
    assetStack: AssetUUID[],
    exits: FacetListData<ExitPayload>
) => {
    const perspectiveKey = computePerspectiveKey(assetStack)
    return createAffordanceCacheRow({
        roomId,
        perspectiveKey,
        assetStack,
        catalogVersion: 1,
        hydratedCatalogVersion: 1,
        topology: {
            roomUniversalKey: roomId,
            exits,
        },
    })
}

const getForStack = async (roomId: EphemeraRoomId, assetStack: AssetUUID[]) => (
    internalCache.AffordanceRoomDeliverable.get(roomId, computePerspectiveKey(assetStack))
)

describe('AffordanceRoomDeliverable cache handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        jest.spyOn(internalCache.ComponentEphemeraMeta, 'get').mockResolvedValue(undefined)
        jest.spyOn(internalCache.Positions, 'getLudicGraph').mockResolvedValue(testPositionGraph('ROOM#ParityOne'))
    })

    it('builds structural room WML from aggregate shortName, affordance topology, and roster', async () => {
        const assetStack: AssetUUID[] = ['ASSET#Base']
        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: 'ROOM#ParityOne',
                merged: new StandardRoom({
                    universalKey: 'ROOM#ParityOne',
                    tag: 'Room',
                    shortName: 'Hall',
                    exits: [],
                }),
                mergeParticipationOrderApplied: assetStack,
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow('ROOM#ParityOne', assetStack, [])
        )
        jest.spyOn(hydrateRoomRosterModule, 'getRoomCharacterList').mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', DisplayName: 'Tess', Color: 'purple', SessionIds: [] },
        ])

        const merged = await getForStack('ROOM#ParityOne', assetStack)

        expect(schemaToWML([merged.schema])).toEqual(
            deIndentWML(`
            <Asset uuid=(render)>
                <Character uuid=(TESS) ref={0}><DisplayName>Tess</DisplayName></Character>
                <Room uuid=(ParityOne) ref={0}>
                    <ShortName>Hall</ShortName>
                    <Character uuid=(TESS) />
                </Room>
            </Asset>
        `)
        )
    })

    it('merges shortName via ComponentAggregate and exits from AffordanceCache across two assets', async () => {
        const assetStack: AssetUUID[] = ['ASSET#Base', 'ASSET#Personal']
        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: 'ROOM#MergeTwo',
                merged: new StandardRoom({
                    universalKey: 'ROOM#MergeTwo',
                    tag: 'Room',
                    shortName: 'NorthWingAnnex',
                    exits: [],
                }),
                mergeParticipationOrderApplied: assetStack,
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow('ROOM#MergeTwo', assetStack, [
                {
                    reference: { tag: 'Room' as const, universalKey: 'ROOM#DestNorth' },
                    payload: 'North door',
                },
                {
                    reference: { tag: 'Room' as const, universalKey: 'ROOM#DestEast' },
                    payload: 'East stair',
                },
            ])
        )
        jest.spyOn(hydrateRoomRosterModule, 'getRoomCharacterList').mockResolvedValue([])

        const merged = await getForStack('ROOM#MergeTwo', assetStack)

        expect(schemaToWML([merged.schema])).toEqual(
            deIndentWML(`
            <Asset uuid=(render)>
                <Room uuid=(MergeTwo) ref={0}>
                    <ShortName>NorthWingAnnex</ShortName>
                    <Exit to=(ROOM#DestNorth)>North door</Exit>
                    <Exit to=(ROOM#DestEast)>East stair</Exit>
                </Room>
            </Asset>
        `)
        )
    })

    it('uses affordanceRow.assetStack for ComponentAggregate merge participation order', async () => {
        const roomId = 'ROOM#StackAlign' as const
        const assetStack: AssetUUID[] = ['ASSET#Canon', 'ASSET#Personal']
        const perspectiveKey = computePerspectiveKey(assetStack)
        const aggregateGet = jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: roomId,
                merged: new StandardRoom({
                    universalKey: roomId,
                    tag: 'Room',
                    shortName: 'Aligned',
                    exits: [],
                }),
                mergeParticipationOrderApplied: assetStack,
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow(roomId, assetStack, [])
        )
        jest.spyOn(hydrateRoomRosterModule, 'getRoomCharacterList').mockResolvedValue([])

        await internalCache.AffordanceRoomDeliverable.get(roomId, perspectiveKey)

        expect(aggregateGet).toHaveBeenCalledWith([
            expect.objectContaining({
                universalKey: roomId,
                mergeParticipationOrder: assetStack,
            }),
        ])
    })

    it('cache-hits on repeated get(roomId, perspectiveKey)', async () => {
        const roomId = 'ROOM#CacheHit' as const
        const assetStack: AssetUUID[] = ['ASSET#Base']
        const perspectiveKey = computePerspectiveKey(assetStack)
        const aggregateGet = jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: roomId,
                merged: new StandardRoom({
                    universalKey: roomId,
                    tag: 'Room',
                    shortName: 'Once',
                    exits: [],
                }),
                mergeParticipationOrderApplied: assetStack,
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow(roomId, assetStack, [])
        )
        jest.spyOn(hydrateRoomRosterModule, 'getRoomCharacterList').mockResolvedValue([])

        await internalCache.AffordanceRoomDeliverable.get(roomId, perspectiveKey)
        await internalCache.AffordanceRoomDeliverable.get(roomId, perspectiveKey)

        expect(aggregateGet).toHaveBeenCalledTimes(1)
    })

    it('uses projected AffordanceCache exits instead of mergeRoomExitsToJSON concat (D30 overlay)', async () => {
        const roomId = 'ROOM#Overlay' as const
        const assetStack: AssetUUID[] = ['ASSET#Base', 'ASSET#Personal']
        const baseRoom = new StandardRoom({
            universalKey: roomId,
            tag: 'Room',
            shortName: 'Hall',
            exits: [
                {
                    reference: { tag: 'Room', universalKey: 'ROOM#DestD' },
                    payload: 'D door',
                },
                {
                    reference: { tag: 'Room', universalKey: 'ROOM#DestE' },
                    payload: 'E door',
                },
            ],
        })
        const overlayRoom = new StandardRoom({
            universalKey: roomId,
            tag: 'Room',
            exits: [
                {
                    reference: { tag: 'Room', universalKey: 'ROOM#DestF' },
                    payload: 'F stair',
                },
            ],
        })
        const concatWouldIncludeD = mergeRoomExitsToJSON([baseRoom, overlayRoom])
        expect(concatWouldIncludeD).toHaveLength(3)

        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: roomId,
                merged: baseRoom.merge(overlayRoom) as StandardRoom,
                mergeParticipationOrderApplied: assetStack,
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow(roomId, assetStack, [
                {
                    reference: { tag: 'Room' as const, universalKey: 'ROOM#DestE' },
                    payload: 'E door',
                },
                {
                    reference: { tag: 'Room' as const, universalKey: 'ROOM#DestF' },
                    payload: 'F stair',
                },
            ])
        )
        jest.spyOn(hydrateRoomRosterModule, 'getRoomCharacterList').mockResolvedValue([])

        const merged = await getForStack(roomId, assetStack)
        const wml = schemaToWML([merged.schema])

        expect(wml).toContain('E door')
        expect(wml).toContain('F stair')
        expect(wml).not.toContain('D door')
    })

    it('includes graph-placed objects on the merged room', async () => {
        const assetStack: AssetUUID[] = ['ASSET#Base']
        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: 'ROOM#ObjRoom',
                merged: new StandardRoom({
                    universalKey: 'ROOM#ObjRoom',
                    tag: 'Room',
                    shortName: 'Hall',
                    exits: [],
                }),
                mergeParticipationOrderApplied: [...assetStack, 'ASSET#IMPROVISATION'],
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow('ROOM#ObjRoom', assetStack, [])
        )
        jest.spyOn(hydrateRoomRosterModule, 'getRoomCharacterList').mockResolvedValue([])
        jest.spyOn(internalCache.Positions, 'getLudicGraph').mockResolvedValue(
            testPositionGraph('ROOM#ObjRoom', {
                nodes: [{ tag: 'Object', universalKey: 'OBJECT#foo' }],
            })
        )
        jest.spyOn(internalCache.ImprovisationComponentData, 'get').mockResolvedValue({
            universalKey: 'OBJECT#foo',
            assetId: 'ASSET#IMPROVISATION',
            component: new StandardObject({
                tag: 'Object',
                universalKey: 'OBJECT#foo',
                shortName: 'A lamp',
            }),
        } as any)

        const merged = await getForStack('ROOM#ObjRoom', assetStack)

        const wml = schemaToWML([merged.schema])
        expect(wml).toContain('<Object uuid=(foo)')
        expect(wml).toContain('A lamp')
    })

    it('throws when AffordanceCache row is missing (no mergeRoomExitsToJSON fallback)', async () => {
        const roomId = 'ROOM#Missing' as const
        const perspectiveKey = computePerspectiveKey(['ASSET#Base'])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(undefined)
        jest.spyOn(hydrateRoomRosterModule, 'getRoomCharacterList').mockResolvedValue([])

        await expect(
            (internalCache.AffordanceRoomDeliverable as any)._getPromiseFactory(roomId, perspectiveKey)
        ).rejects.toThrow('AFFORDANCE_TOPOLOGY_NOT_READY')
    })

    it('invalidate(roomId) refetches that room only', async () => {
        const roomA = 'ROOM#InvA' as const
        const roomB = 'ROOM#InvB' as const
        const assetStack: AssetUUID[] = ['ASSET#Base']
        const perspectiveKey = computePerspectiveKey(assetStack)
        const aggregateGet = jest.spyOn(internalCache.ComponentAggregate, 'get').mockImplementation(
            async (perspectives) => {
                const roomId = perspectives[0].universalKey as EphemeraRoomId
                return [{
                    universalKey: roomId,
                    merged: new StandardRoom({
                        universalKey: roomId,
                        tag: 'Room',
                        shortName: roomId === roomA ? 'Alpha' : 'Beta',
                        exits: [],
                    }),
                    mergeParticipationOrderApplied: assetStack,
                }]
            }
        )
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockImplementation(
            async (roomId, _perspectiveKey) => mockAffordanceRow(roomId, assetStack, [])
        )
        jest.spyOn(hydrateRoomRosterModule, 'getRoomCharacterList').mockResolvedValue([])

        await internalCache.AffordanceRoomDeliverable.get(roomA, perspectiveKey)
        await internalCache.AffordanceRoomDeliverable.get(roomB, perspectiveKey)
        const callsAfterWarm = aggregateGet.mock.calls.length

        internalCache.AffordanceRoomDeliverable.invalidate(roomA)

        await internalCache.AffordanceRoomDeliverable.get(roomA, perspectiveKey)
        expect(aggregateGet.mock.calls.length).toBe(callsAfterWarm + 1)

        await internalCache.AffordanceRoomDeliverable.get(roomB, perspectiveKey)
        expect(aggregateGet.mock.calls.length).toBe(callsAfterWarm + 1)
    })
})
