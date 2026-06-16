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
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { deIndentWML } from "@tonylb/mtw-wml/ts/schema/utils"
import type { ComponentAcrossAssetsEntry } from '@tonylb/mtw-gateways/ts/assets/components/componentData'

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

    it('should update maps correctly', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her'
        })
        jest.spyOn(internalCache.ComponentData, "getAcrossAssets").mockImplementation(async (ephemeraId) => {
            switch(ephemeraId) {
                case 'MAP#TestOne':
                    return {
                        [`ASSET#Base`]: componentEntry(new StandardMap({
                            universalKey: 'MAP#TestOne',
                            shortName: 'Test Map',
                            images: [],
                            positions: [{ reference: 'ROOM#TestRoomOne', payload: { x: 0, y: 0 } }],
                            tag: 'Map',
                        })),
                        [`ASSET#Personal`]: componentEntry(new StandardMap({
                            universalKey: 'MAP#TestOne',
                            images: [],
                            positions: [{ reference: 'ROOM#TestRoomTwo', payload: { x: 100, y: 0 } }],
                            tag: 'Map',
                        })),
                    }
                case 'ROOM#TestRoomOne':
                    return {
                        [`ASSET#Base`]: componentEntry(new StandardRoom({
                            universalKey: 'ROOM#TestRoomOne',
                            shortName: 'Test Room One',
                            exits: [
                                { reference: 'ROOM#TestRoomTwo', payload: 'Other Room' },
                                { reference: 'ROOM#TestRoomThree', payload: 'Not in Map' }
                            ],
                            tag: 'Room',
                        })),
                        [`ASSET#Personal`]: componentEntry(new StandardRoom({ universalKey: 'ROOM#TestRoomOne', exits: [], tag: 'Room' })),
                    }
                case 'ROOM#TestRoomTwo':
                    return {
                        [`ASSET#Base`]: componentEntry(new StandardRoom({
                            universalKey: 'ROOM#TestRoomTwo',
                            shortName: 'Test Room Two',
                            exits: [],
                            tag: 'Room',
                        })),
                        [`ASSET#Personal`]: componentEntry(new StandardRoom({
                            universalKey: 'ROOM#TestRoomTwo',
                            exits: [
                                { reference: 'ROOM#TestRoomOne', payload: 'First Room' }
                            ],
                            tag: 'Room',
                        })),
                    }
            }
            throw new Error(`Invalid test EphemeraID: ${ephemeraId}`)
        })
        mockGetRoomCharacterList.mockResolvedValue([])
        // EvaluateCode removed - Variable/Computed evaluation no longer available
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "MAP#TestOne")
        expect(schemaToWML([output.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Room uuid=(TestRoomOne) ref={0}>
                    <ShortName>Test Room One</ShortName>
                    <Exit to=(ROOM#TestRoomTwo)>Other Room</Exit>
                </Room>
                <Room uuid=(TestRoomTwo) ref={0}>
                    <ShortName>Test Room Two</ShortName>
                    <Exit to=(ROOM#TestRoomOne)>First Room</Exit>
                </Room>
                <Map uuid=(TestOne) ref={0}>
                    <ShortName>Test Map</ShortName>
                    <Room uuid=(TestRoomOne)><Position {0, 0} /></Room>
                    <Room uuid=(TestRoomTwo)><Position {100, 0} /></Room>
                </Map>
            </Asset>
        `))
    })

})