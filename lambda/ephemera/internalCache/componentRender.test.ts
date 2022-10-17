import internalCache from "../internalCache"
jest.mock('../messageBus')
import messageBus from '../messageBus'
jest.mock('@tonylb/mtw-utilities/dist/dynamoDB')
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { ComponentMetaMapItem, ComponentMetaRoomItem } from '../internalCache/componentMeta'

import perceptionMessage from '.'

const messageBusMock = messageBus as jest.Mocked<typeof messageBus>
const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('ComponentRender cache handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should render only appearances whose condition succeeds', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testOne', dependencies: [] }],
                        name: 'TestRoom',
                        render: [{ tag: 'String', value: 'First' }],
                        exits: []
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [] }],
                        name: '',
                        render: [{ tag: 'String', value: 'ERROR' }],
                        exits: []
                    }
                ]
            },
            Personal: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testThree', dependencies: [] }],
                        name: 'ERROR',
                        render: [{ tag: 'String', value: 'ERROR' }],
                        exits: []
                    },
                    {
                        conditions: [{ if: 'testFour', dependencies: [] }],
                        name: '',
                        render: [{ tag: 'String', value: 'Second' }],
                        exits: []
                    }
                ]
            }
        })
        jest.spyOn(internalCache.EvaluateCode, "get").mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('ROOM#TestOne', ['Base', 'Personal'])
        expect(output).toEqual({
            RoomId: 'ROOM#TestOne',
            Name: 'TestRoom',
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            Exits: []
        })
    })

    it('should render only features correctly', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'FEATURE#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testOne', dependencies: [] }],
                        name: 'TestFeature',
                        render: [{ tag: 'String', value: 'First' }],
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [] }],
                        name: '',
                        render: [{ tag: 'String', value: 'ERROR' }],
                    }
                ]
            },
            Personal: {
                EphemeraId: 'FEATURE#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testThree', dependencies: [] }],
                        name: 'ERROR',
                        render: [{ tag: 'String', value: 'ERROR' }],
                    },
                    {
                        conditions: [{ if: 'testFour', dependencies: [] }],
                        name: '',
                        render: [{ tag: 'String', value: 'Second' }],
                    }
                ]
            }
        })
        jest.spyOn(internalCache.EvaluateCode, "get").mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "FEATURE#TestOne")
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('FEATURE#TestOne', ['Base', 'Personal'])
        expect(output).toEqual({
            FeatureId: 'FEATURE#TestOne',
            Name: 'TestFeature',
            Description: [{ tag: 'String', value: 'FirstSecond' }],
        })
    })

    it('should update maps correctly', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: ['Personal'],
            RoomId: 'ROOM#VORTEX',
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValueOnce({
            Base: {
                EphemeraId: 'MAP#TestOne',
                assetId: 'Base',
                appearances: [{
                    conditions: [],
                    name: 'Test Map',
                    fileURL: 'https://test.com/test.png',
                    rooms: {
                        TestRoomOne: {
                            EphemeraId: 'ROOM#TestRoomOne',
                            x: 0,
                            y: 0
                        }
                    }
                }]
            },
            Personal: {
                EphemeraId: 'MAP#TestOne',
                assetId: 'Personal',
                appearances: [{
                    conditions: [],
                    name: '',
                    fileURL: '',
                    rooms: {
                        TestRoomOne: {
                            EphemeraId: 'ROOM#TestRoomTwo',
                            x: 100,
                            y: 0
                        }
                    }
                }]
            }
        } as Record<string, ComponentMetaMapItem>).mockResolvedValueOnce({
            Base: {
                EphemeraId: 'ROOM#TestRoomOne',
                assetId: 'Base',
                appearances: [{
                    conditions: [],
                    name: 'Test Room One',
                    render: [],
                    exits: [
                        {
                            to: 'ROOM#TestRoomTwo',
                            name: 'Other Room'
                        },
                        {
                            to: 'ROOM#TestRoomThree',
                            name: 'Not in Map'
                        }
                    ]
                }]
            },
            Personal: { EphemeraId: 'ROOM#TestRoomOne', assetId: 'Personal', appearances: [] }
        } as Record<string, ComponentMetaRoomItem>).mockResolvedValueOnce({
            Base: { EphemeraId: 'ROOM#TestRoomOne', assetId: 'Base', appearances: [] },
            Personal: {
                EphemeraId: 'ROOM#TestRoomTwo',
                assetId: 'Personal',
                appearances: [{
                    conditions: [],
                    name: 'Test Room Two',
                    render: [],
                    exits: [
                        {
                            to: 'ROOM#TestRoomOne',
                            name: 'First Room'
                        }
                    ]
                }]
            }
        } as Record<string, ComponentMetaRoomItem>)
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "MAP#TestOne")
        expect(output).toEqual({
            MapId: 'MAP#TestOne',
            Name: 'Test Map',
            fileURL: 'https://test.com/test.png',
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
            ]
        })
    })

    it('should correctly invalidate evaluations on asset state change', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [],
                        name: 'TestRoom',
                        render: [{ tag: 'String', value: 'First' }],
                        exits: []
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [{ key: 'testTwo', EphemeraId: 'VARIABLE#testVariable' }] }],
                        name: '',
                        render: [{ tag: 'String', value: 'Second' }],
                        exits: []
                    }
                ]
            }
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [] }
        ])
        jest.spyOn(internalCache.EvaluateCode, "get")
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
        const outputOne = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('ROOM#TestOne', ['Base'])
        expect(internalCache.EvaluateCode.get).toHaveBeenCalledTimes(1)
        expect(outputOne).toEqual({
            RoomId: 'ROOM#TestOne',
            Name: 'TestRoom',
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'First' }],
            Exits: []
        })

        internalCache.AssetState.invalidate('VARIABLE#testVariable')
        const outputTwo = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(internalCache.EvaluateCode.get).toHaveBeenCalledTimes(2)
        expect(outputTwo).toEqual({
            RoomId: 'ROOM#TestOne',
            Name: 'TestRoom',
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            Exits: []
        })

        internalCache.AssetState.invalidate('VARIABLE#otherVariable')
        const outputThree = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(internalCache.EvaluateCode.get).toHaveBeenCalledTimes(2)
        expect(outputThree).toEqual({
            RoomId: 'ROOM#TestOne',
            Name: 'TestRoom',
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            Exits: []
        })
    })
})