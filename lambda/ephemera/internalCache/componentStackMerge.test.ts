import internalCache from '../internalCache'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { deIndentWML } from '@tonylb/mtw-wml/ts/schema/utils'

describe('ComponentStackMerge cache handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('matches ComponentRender structural room WML when there is no render facet (no cache, no examples)', async () => {
        jest.spyOn(internalCache.RenderCache, 'get').mockResolvedValue([])
        jest.spyOn(internalCache.Examples, 'get').mockResolvedValue({})
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
                examples: [],
            }),
        })
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', DisplayName: 'Tess', Color: 'purple', SessionIds: [] },
        ])

        const characterId = 'CHARACTER#TESS' as const
        const roomId = 'ROOM#ParityOne' as const

        const merged = await internalCache.ComponentStackMerge.get(characterId, roomId)
        const rendered = await internalCache.ComponentRender.get(characterId, roomId)

        expect(schemaToWML([merged.schema])).toEqual(schemaToWML([rendered.schema]))
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

    it('matches ComponentRender when merging exits and shortName across two assets', async () => {
        jest.spyOn(internalCache.RenderCache, 'get').mockResolvedValue([])
        jest.spyOn(internalCache.Examples, 'get').mockResolvedValue({})
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
                examples: [],
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
                examples: [],
            }),
        })
        jest.spyOn(internalCache.RoomCharacterList, 'get').mockResolvedValue([])

        const characterId = 'CHARACTER#TESS' as const
        const roomId = 'ROOM#MergeTwo' as const

        const merged = await internalCache.ComponentStackMerge.get(characterId, roomId)
        const rendered = await internalCache.ComponentRender.get(characterId, roomId)

        expect(schemaToWML([merged.schema])).toEqual(schemaToWML([rendered.schema]))
    })
})
