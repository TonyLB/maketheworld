import internalCache from "../internalCache"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import StandardKnowledge from "@tonylb/mtw-wml/ts/standardize/components/knowledge"
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { deIndentWML } from "@tonylb/mtw-wml/ts/schema/utils"

describe('ComponentRender cache handler', () => {

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should render room descriptions and headers differently', async () => {
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
        jest.spyOn(internalCache.Examples, "get").mockResolvedValue({
            'ROOM#TestOne': [{
                assetId: 'TestAsset',
                examples: [
                    new StandardExample({
                        tag: 'Example',
                        universalKey: 'EXAMPLE#Base',
                        name: ['Example Name'],
                        description: ['Description'],
                        summary: ['Summary']
                    })
                ]
            }]
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            [`ASSET#Base`]: new StandardRoom({
                universalKey: 'ROOM#TestOne',
                tag: 'Room',
                shortName: 'TestRoom',
                exits: [],
                examples: ['EXAMPLE#Base']
            })
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', SessionIds: [] }
        ])
        const descriptionOutput = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(schemaToWML([descriptionOutput.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Character uuid=(TESS) ref={0}><Name>Tess</Name></Character>
                <Example uuid=(rendered) ref={0}>
                    <Name>Example Name</Name>
                    <Summary>Summary</Summary>
                    <Description>Description</Description>
                </Example>
                <Room uuid=(TestOne) ref={0}>
                    <ShortName>TestRoom</ShortName>
                    <Example uuid=(rendered) />
                    <Character uuid=(TESS) />
                </Room>
            </Asset>
        `))
    })

    it('should render only features correctly', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: 'she/her',
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            [`ASSET#Base`]: new StandardFeature({
                universalKey: 'FEATURE#TestOne',
                tag: 'Feature',
            }),
            [`ASSET#Personal`]: new StandardFeature({
                universalKey: 'FEATURE#TestOne',
                tag: 'Feature',
            })
        })
        jest.spyOn(internalCache.Examples, "get").mockResolvedValue({
            'FEATURE#TestOne': [{
                assetId: 'Personal',
                examples: [
                    new StandardExample({
                        tag: 'Example',
                        universalKey: 'EXAMPLE#Base',
                        name: ['Example Name'],
                        description: ['Description'],
                        summary: []
                    })
                ]
            }]
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', SessionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "FEATURE#TestOne")
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('FEATURE#TestOne', ['ASSET#Base', 'ASSET#Personal'])
        expect(schemaToWML([output.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Example uuid=(rendered) ref={0}>
                    <Name>Example Name</Name>
                    <Description>Description</Description>
                </Example>
                <Feature uuid=(TestOne) ref={0}><Example uuid=(rendered) /></Feature>
            </Asset>
        `))
    })

    it('should render only knowledge correctly', async () => {
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
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            [`ASSET#Base`]: new StandardKnowledge({
                universalKey: 'KNOWLEDGE#TestOne',
                tag: 'Knowledge',
            }),
            [`ASSET#Personal`]: new StandardKnowledge({
                universalKey: 'KNOWLEDGE#TestOne',
                tag: 'Knowledge',
            })
        })
        jest.spyOn(internalCache.Examples, "get").mockResolvedValue({
            'KNOWLEDGE#TestOne': [{
                assetId: 'Personal',
                examples: [
                    new StandardExample({
                        tag: 'Example',
                        key: 'example1',
                        universalKey: 'EXAMPLE#Base',
                        name: ['Example Name'],
                        description: ['Description'],
                        summary: ['Summary']
                    })
                ]
            }]
        })
        // EvaluateCode removed - Variable/Computed evaluation no longer available
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', SessionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "KNOWLEDGE#TestOne")
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('KNOWLEDGE#TestOne', ['ASSET#Base', 'ASSET#Personal'])
        expect(schemaToWML([output.schema])).toEqual(deIndentWML(`
            <Asset uuid=(render)>
                <Example uuid=(rendered) key=(example1) ref={0}>
                    <Name>Example Name</Name>
                    <Summary>Summary</Summary>
                    <Description>Description</Description>
                </Example>
                <Knowledge uuid=(TestOne) ref={0}><Example key=(example1) /></Knowledge>
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
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockImplementation(async (ephemeraId) => {
            switch(ephemeraId) {
                case 'MAP#TestOne':
                    return {
                        [`ASSET#Base`]: new StandardMap({
                            universalKey: 'MAP#TestOne',
                            shortName: 'Test Map',
                            images: [],
                            positions: [{ reference: 'ROOM#TestRoomOne', payload: { x: 0, y: 0 } }],
                            tag: 'Map',
                        }),
                        [`ASSET#Personal`]: new StandardMap({
                            universalKey: 'MAP#TestOne',
                            images: [],
                            positions: [{ reference: 'ROOM#TestRoomTwo', payload: { x: 100, y: 0 } }],
                            tag: 'Map',
                        })
                    } as Record<AssetUUID, StandardComponent>
                case 'ROOM#TestRoomOne':
                    return {
                        [`ASSET#Base`]: new StandardRoom({
                            universalKey: 'ROOM#TestRoomOne',
                            shortName: 'Test Room One',
                            exits: [
                                { reference: 'ROOM#TestRoomTwo', payload: 'Other Room' },
                                { reference: 'ROOM#TestRoomThree', payload: 'Not in Map' }
                            ],
                            tag: 'Room',
                        }),
                        [`ASSET#Personal`]: new StandardRoom({ universalKey: 'ROOM#TestRoomOne', exits: [], tag: 'Room' })
                    } as Record<AssetUUID, StandardComponent>
                case 'ROOM#TestRoomTwo':
                    return {
                        [`ASSET#Base`]: new StandardRoom({
                            universalKey: 'ROOM#TestRoomTwo',
                            shortName: 'Test Room Two',
                            exits: [],
                            tag: 'Room',
                        }),
                        [`ASSET#Personal`]: new StandardRoom({
                            universalKey: 'ROOM#TestRoomTwo',
                            exits: [
                                { reference: 'ROOM#TestRoomOne', payload: 'First Room' }
                            ],
                            tag: 'Room'
                        })
                    }
            }
            throw new Error(`Invalid test EphemeraID: ${ephemeraId}`)
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([])
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