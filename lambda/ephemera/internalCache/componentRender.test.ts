const mockGetRoomCharacterList = jest.fn()
jest.mock('./hydrateRoomRoster', () => {
    const actual = jest.requireActual('./hydrateRoomRoster') as typeof import('./hydrateRoomRoster')
    return {
        ...actual,
        getRoomCharacterList: (...args: Parameters<typeof actual.getRoomCharacterList>) =>
            mockGetRoomCharacterList(...args),
    }
})

import internalCache from "../internalCache"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { deIndentWML } from "@tonylb/mtw-wml/ts/schema/utils"
import type { ComponentAcrossAssetsEntry } from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import { MAP_SERVER_RENDER_RETIRED } from '../dataSource/maps/stub'

const componentEntry = (component: StandardComponent): ComponentAcrossAssetsEntry => ({ component })

describe('ComponentRender cache handler', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        mockGetRoomCharacterList.mockResolvedValue([])
        internalCache.clear()
    })

    it('omits Render for Room when render cache is empty', async () => {
        jest.spyOn(internalCache.RenderCache, "get").mockResolvedValue([])
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her'
        })
        jest.spyOn(internalCache.ComponentData, "getAcrossAssets").mockResolvedValue({
            [`ASSET#Base`]: componentEntry(new StandardRoom(deIndentWML(`
                <Room uuid=(TestOne)>
                    <ShortName>TestRoom</ShortName>
                    <Situation uuid=(DEFAULT)>
                        <DisplayName>Situation prose</DisplayName>
                    </Situation>
                </Room>
            `))),
        })
        mockGetRoomCharacterList.mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', DisplayName: 'Tess', Color: 'purple', SessionIds: [] }
        ])
        const descriptionOutput = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(schemaToWML([descriptionOutput.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Character uuid=(TESS) ref={0}><DisplayName>Tess</DisplayName></Character>
                <Room uuid=(TestOne) ref={0}>
                    <ShortName>TestRoom</ShortName>
                    <Character uuid=(TESS) />
                </Room>
            </Asset>
        `))
    })

    it('should prefer render cache for Room when it has a record (Phase 3)', async () => {
        const cacheRecord = {
            EphemeraId: 'ROOM#TestOne',
            DataCategory: 'CACHE#test-uuid',
            markState: { markValue: [] },
            renderedContent: {
                displayName: ['From Cache'],
                summary: ['Cache Summary'],
                description: ['Cache description content'],
            },
            provenance: { type: 'authored' as const },
            perspectiveId: 'PERSPECTIVE#test',
            perspectiveMatcher: { requiredAssetIds: [], forbiddenAssetIds: [] },
            situationId: 'SITUATION#situation-one',
        }
        ;(jest.spyOn(internalCache.RenderCache, "get").mockResolvedValue([cacheRecord as any]))
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her',
        })
        jest.spyOn(internalCache.ComponentData, "getAcrossAssets").mockResolvedValue({
            [`ASSET#Base`]: componentEntry(new StandardRoom({
                universalKey: 'ROOM#TestOne',
                tag: 'Room',
                shortName: 'TestRoom',
                exits: [],
            })),
        })
        mockGetRoomCharacterList.mockResolvedValue([])
        const descriptionOutput = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(schemaToWML([descriptionOutput.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Room uuid=(TestOne) ref={0}>
                    <ShortName>TestRoom</ShortName>
                    <Render>
                        <DisplayName>From Cache</DisplayName>
                        <Summary>Cache Summary</Summary>
                        <Description>Cache description content</Description>
                    </Render>
                </Room>
            </Asset>
        `))
    })

    it('throws MAP_SERVER_RENDER_RETIRED for MAP# ids', async () => {
        await expect(
            internalCache.ComponentRender.get('CHARACTER#TESS', 'MAP#TestOne')
        ).rejects.toThrow(MAP_SERVER_RENDER_RETIRED)
    })

})