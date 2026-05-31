import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../internalCache'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'
import { mergeRoomExitsToJSON } from './componentStackMerge'
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

describe('ComponentStackMerge cache handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        jest.spyOn(internalCache.ComponentEphemeraMeta, 'get').mockResolvedValue(undefined)
    })

    it('builds structural room WML from aggregate shortName, affordance topology, and roster', async () => {
        jest.spyOn(internalCache.Global, 'get').mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her',
        })
        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: 'ROOM#ParityOne',
                merged: new StandardRoom({
                    universalKey: 'ROOM#ParityOne',
                    tag: 'Room',
                    shortName: 'Hall',
                    exits: [],
                }),
                mergeParticipationOrderApplied: ['ASSET#Base'],
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow('ROOM#ParityOne', ['ASSET#Base'], [])
        )
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', DisplayName: 'Tess', Color: 'purple', SessionIds: [] },
        ])

        const merged = await internalCache.ComponentStackMerge.get('CHARACTER#TESS', 'ROOM#ParityOne')

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
        jest.spyOn(internalCache.Global, 'get').mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her',
        })
        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: 'ROOM#MergeTwo',
                merged: new StandardRoom({
                    universalKey: 'ROOM#MergeTwo',
                    tag: 'Room',
                    shortName: 'NorthWingAnnex',
                    exits: [],
                }),
                mergeParticipationOrderApplied: ['ASSET#Base', 'ASSET#Personal'],
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow('ROOM#MergeTwo', ['ASSET#Base', 'ASSET#Personal'], [
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
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        const merged = await internalCache.ComponentStackMerge.get('CHARACTER#TESS', 'ROOM#MergeTwo')

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

    it('uses projected AffordanceCache exits instead of mergeRoomExitsToJSON concat (D30 overlay)', async () => {
        const roomId = 'ROOM#Overlay' as const
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

        jest.spyOn(internalCache.Global, 'get').mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her',
        })
        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: roomId,
                merged: baseRoom.merge(overlayRoom) as StandardRoom,
                mergeParticipationOrderApplied: ['ASSET#Base', 'ASSET#Personal'],
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow(roomId, ['ASSET#Base', 'ASSET#Personal'], [
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
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        const merged = await internalCache.ComponentStackMerge.get('CHARACTER#TESS', roomId)
        const wml = schemaToWML([merged.schema])

        expect(wml).toContain('E door')
        expect(wml).toContain('F stair')
        expect(wml).not.toContain('D door')
    })

    it('includes Meta::Room.objects on the merged room', async () => {
        jest.spyOn(internalCache.Global, 'get').mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her',
        })
        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: 'ROOM#ObjRoom',
                merged: new StandardRoom({
                    universalKey: 'ROOM#ObjRoom',
                    tag: 'Room',
                    shortName: 'Hall',
                    exits: [],
                }),
                mergeParticipationOrderApplied: ['ASSET#Base'],
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(
            mockAffordanceRow('ROOM#ObjRoom', ['ASSET#Base'], [])
        )
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        const metaRoom: EphemeraMetaRoom = {
            EphemeraId: 'ROOM#ObjRoom' as EphemeraRoomId,
            DataCategory: 'Meta::Room',
            objects: [{ uuid: 'OBJECT#foo', shortName: 'A lamp', stableKey: 'a-lamp' }],
        }
        jest.spyOn(internalCache.ComponentEphemeraMeta, 'get').mockResolvedValue(metaRoom)

        const merged = await internalCache.ComponentStackMerge.get('CHARACTER#TESS', 'ROOM#ObjRoom')

        const wml = schemaToWML([merged.schema])
        expect(wml).toContain('<Object uuid=(foo)')
        expect(wml).toContain('A lamp')
    })

    it('throws when AffordanceCache row is missing (no mergeRoomExitsToJSON fallback)', async () => {
        jest.spyOn(internalCache.Global, 'get').mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her',
        })
        jest.spyOn(internalCache.ComponentAggregate, 'get').mockResolvedValue([
            {
                universalKey: 'ROOM#Missing',
                merged: new StandardRoom({
                    universalKey: 'ROOM#Missing',
                    tag: 'Room',
                    shortName: 'Hall',
                    exits: [],
                }),
                mergeParticipationOrderApplied: ['ASSET#Base'],
            },
        ])
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockResolvedValue(undefined)
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        await expect(
            (internalCache.ComponentStackMerge as any)._getPromiseFactory('CHARACTER#TESS', 'ROOM#Missing')
        ).rejects.toThrow('AFFORDANCE_TOPOLOGY_NOT_READY')
    })

    it('invalidate(roomId) refetches that room only', async () => {
        jest.spyOn(internalCache.Global, 'get').mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, 'get').mockResolvedValue({
            EphemeraId: 'CHARACTER#TESS',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her',
        })
        const roomA = 'ROOM#InvA' as const
        const roomB = 'ROOM#InvB' as const
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
                    mergeParticipationOrderApplied: ['ASSET#Base'],
                }]
            }
        )
        jest.spyOn(internalCache.AffordanceCache, 'getAffordanceRow').mockImplementation(
            async (roomId, _perspectiveKey) => mockAffordanceRow(roomId, ['ASSET#Base'], [])
        )
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        const char = 'CHARACTER#TESS' as const
        await internalCache.ComponentStackMerge.get(char, roomA)
        await internalCache.ComponentStackMerge.get(char, roomB)
        const callsAfterWarm = aggregateGet.mock.calls.length

        internalCache.ComponentStackMerge.invalidate(roomA)

        await internalCache.ComponentStackMerge.get(char, roomA)
        expect(aggregateGet.mock.calls.length).toBe(callsAfterWarm + 1)

        await internalCache.ComponentStackMerge.get(char, roomB)
        expect(aggregateGet.mock.calls.length).toBe(callsAfterWarm + 1)
    })
})
