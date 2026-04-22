import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../internalCache'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('ComponentStackMerge cache handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        jest.spyOn(internalCache.ComponentEphemeraMeta, 'get').mockResolvedValue(undefined)
    })

    it('builds structural room WML from assets and roster (no Meta::Room.objects)', async () => {
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
        jest.spyOn(internalCache.ComponentAssetMeta, 'getAcrossAssets').mockResolvedValue({
            [`ASSET#Base`]: new StandardRoom({
                universalKey: 'ROOM#ParityOne',
                tag: 'Room',
                shortName: 'Hall',
                exits: [],
            }),
        })
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', DisplayName: 'Tess', Color: 'purple', SessionIds: [] },
        ])

        const characterId = 'CHARACTER#TESS' as const
        const roomId = 'ROOM#ParityOne' as const

        const merged = await internalCache.ComponentStackMerge.get(characterId, roomId)

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

    it('merges exits and shortName across two assets', async () => {
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
        jest.spyOn(internalCache.ComponentAssetMeta, 'getAcrossAssets').mockResolvedValue({
            [`ASSET#Base`]: new StandardRoom({
                universalKey: 'ROOM#MergeTwo',
                tag: 'Room',
                shortName: 'NorthWing',
                exits: [
                    {
                        reference: { tag: 'Room' as const, universalKey: 'ROOM#DestNorth' },
                        payload: 'North door',
                    },
                ],
            }),
            [`ASSET#Personal`]: new StandardRoom({
                universalKey: 'ROOM#MergeTwo',
                tag: 'Room',
                shortName: 'Annex',
                exits: [
                    {
                        reference: { tag: 'Room' as const, universalKey: 'ROOM#DestEast' },
                        payload: 'East stair',
                    },
                ],
            }),
        })
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        const characterId = 'CHARACTER#TESS' as const
        const roomId = 'ROOM#MergeTwo' as const

        const merged = await internalCache.ComponentStackMerge.get(characterId, roomId)

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
        jest.spyOn(internalCache.ComponentAssetMeta, 'getAcrossAssets').mockResolvedValue({
            [`ASSET#Base`]: new StandardRoom({
                universalKey: 'ROOM#ObjRoom',
                tag: 'Room',
                shortName: 'Hall',
                exits: [],
            }),
        })
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
        const makeRoom = (universalKey: EphemeraRoomId, shortName: string) =>
            new StandardRoom({
                universalKey,
                tag: 'Room',
                shortName,
                exits: [],
            })
        const getAcrossAssets = jest.spyOn(internalCache.ComponentAssetMeta, 'getAcrossAssets').mockImplementation(
            async (ephemeraId: ComponentUUID) => ({
                [`ASSET#Base`]: makeRoom(
                    ephemeraId as EphemeraRoomId,
                    ephemeraId === roomA ? 'Alpha' : 'Beta'
                ),
            })
        )
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        const char = 'CHARACTER#TESS' as const
        await internalCache.ComponentStackMerge.get(char, roomA)
        await internalCache.ComponentStackMerge.get(char, roomB)
        const callsAfterWarm = getAcrossAssets.mock.calls.length

        internalCache.ComponentStackMerge.invalidate(roomA)

        await internalCache.ComponentStackMerge.get(char, roomA)
        expect(getAcrossAssets.mock.calls.length).toBe(callsAfterWarm + 1)

        await internalCache.ComponentStackMerge.get(char, roomB)
        expect(getAcrossAssets.mock.calls.length).toBe(callsAfterWarm + 1)
    })
})
