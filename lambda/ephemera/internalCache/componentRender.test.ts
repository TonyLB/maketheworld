import { EphemeraMapId, EphemeraRoomId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import internalCache from "../internalCache"
import { ComponentMetaItem } from "./componentMeta"
import StandardExample from "@tonylb/mtw-wml/ts/standardize/components/example"
import StandardRoom from "@tonylb/mtw-wml/ts/standardize/components/room"
import StandardFeature from "@tonylb/mtw-wml/ts/standardize/components/feature"
import StandardKnowledge from "@tonylb/mtw-wml/ts/standardize/components/knowledge"
import { StandardMapData } from "@tonylb/mtw-wml/ts/standardize/components/dataTypes/map"
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { StandardComponent } from "@tonylb/mtw-wml/ts/standardize/components/baseClasses"
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
// import { ComponentMetaMapItem, ComponentMetaRoomItem } from '../internalCache/componentMeta'
// import { componentAppearanceReduce } from "./componentRender"

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
        expect(descriptionOutput).toEqual({
            RoomId: 'ROOM#TestOne',
            ShortName: 'TestRoom',
            Name: ['Example Name'],
            Summary: [],
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: ['Description'],
            Exits: [],
            assets: ['ASSET#Base']
        })
        const summaryOutput = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne', { header: true })
        expect(summaryOutput).toEqual({
            RoomId: 'ROOM#TestOne',
            ShortName: 'TestRoom',
            Name: ['Example Name'],
            Summary: ['Summary'],
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [],
            Exits: [],
            assets: ['ASSET#Base']
        })
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
                        summary: ['Summary']
                    })
                ]
            }]
        })
        jest.spyOn(internalCache.EvaluateCode, "get").mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', SessionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "FEATURE#TestOne")
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('FEATURE#TestOne', ['ASSET#Base', 'ASSET#Personal'])
        expect(output).toEqual({
            FeatureId: 'FEATURE#TestOne',
            Name: ['Example Name'],
            Description: ['Description'],
            assets: ['ASSET#Base', 'ASSET#Personal']
        })
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
        jest.spyOn(internalCache.EvaluateCode, "get").mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', SessionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "KNOWLEDGE#TestOne")
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('KNOWLEDGE#TestOne', ['ASSET#Base', 'ASSET#Personal'])
        expect(output).toEqual({
            KnowledgeId: 'KNOWLEDGE#TestOne',
            Name: ["Example Name"],
            Description: ["Description"],
            assets: ['ASSET#Base', 'ASSET#Personal']
        })
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
                            name: 'Test Map',
                            images: [],
                            positions: [{ room: 'ROOM#TestRoomOne', x: 0, y: 0 }],
                            tag: 'Map',
                        }),
                        [`ASSET#Personal`]: new StandardMap({
                            universalKey: 'MAP#TestOne',
                            images: [],
                            positions: [{ room: 'ROOM#TestRoomTwo', x: 100, y: 0 }],
                            tag: 'Map',
                        })
                    } as Record<AssetUUID, StandardComponent>
                case 'ROOM#TestRoomOne':
                    return {
                        [`ASSET#Base`]: new StandardRoom({
                            universalKey: 'ROOM#TestRoomOne',
                            shortName: 'Test Room One',
                            exits: [
                                { to: 'ROOM#TestRoomTwo', description: 'Other Room' },
                                { to: 'ROOM#TestRoomThree', description: 'Not in Map' }
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
                                { to: 'ROOM#TestRoomOne', description: 'First Room' }
                            ],
                            tag: 'Room'
                        })
                    }
            }
            throw new Error(`Invalid test EphemeraID: ${ephemeraId}`)
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([])
        jest.spyOn(internalCache.EvaluateCode, "get").mockResolvedValue(false)
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "MAP#TestOne")
        expect(output).toEqual({
            MapId: 'MAP#TestOne',
            name: 'Test Map',
            fileURL: '',
            rooms: [
                {
                    roomId: 'ROOM#TestRoomOne',
                    name: 'Test Room One',
                    x: 0,
                    y: 0,
                    exits: [{
                        to: 'ROOM#TestRoomTwo',
                        name: 'Other Room'
                    }]
                },
                {
                    roomId: 'ROOM#TestRoomTwo',
                    name: 'Test Room Two',
                    x: 100,
                    y: 0,
                    exits: [{
                        to: 'ROOM#TestRoomOne',
                        name: 'First Room'
                    }]
                }
            ],
            assets: ['ASSET#Base', 'ASSET#Personal']
        })
    })

})