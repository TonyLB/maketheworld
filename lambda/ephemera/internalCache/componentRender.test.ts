import { EphemeraMapId, EphemeraRoomId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import internalCache from "../internalCache"
import { ComponentMetaItem } from "./componentMeta"
// import { ComponentMetaMapItem, ComponentMetaRoomItem } from '../internalCache/componentMeta'
// import { componentAppearanceReduce } from "./componentRender"

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
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                shortName: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testOne' },
                        children: [{ data: { tag: 'String', value: 'TestRoom' }, children: [] }]
                    }]
                }],
                name: [],
                summary: [],
                render: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testOne' },
                        children: [{ data: { tag: 'String', value: 'First' }, children: [] }]
                    }]
                },
                {
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testTwo' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                }],
                exits: [],
                key: 'testRoom',
                stateMapping: {
                    testOne: 'VARIABLE#One',
                    testTwo: 'VARIABLE#Two'
                },
                keyMapping: {}
            },
            Personal: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                shortName: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testThree' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                }],
                name: [],
                summary: [],
                render: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testThree' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                },
                {
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testFour' },
                        children: [{ data: { tag: 'String', value: 'Second' }, children: [] }]
                    }]
                }],
                exits: [],
                key: 'testRoom',
                stateMapping: {
                    testThree: 'VARIABLE#Three',
                    testFour: 'VARIABLE#Four'
                },
                keyMapping: {}
            }
        })
        jest.spyOn(internalCache.EvaluateCode, "get").mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [], SessionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('ROOM#TestOne', ['Base', 'Personal'])
        expect(output).toEqual({
            RoomId: 'ROOM#TestOne',
            ShortName: [{ tag: 'String', value: 'TestRoom' }],
            Name: [],
            Summary: [],
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            Exits: [],
            assets: {
                ['ASSET#Base']: 'testRoom',
                ['ASSET#Personal']: 'testRoom'
            }
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
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'FEATURE#TestOne',
                assetId: 'Base',
                name: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testOne' },
                        children: [{ data: { tag: 'String', value: 'TestFeature' }, children: [] }]
                    }]
                }],
                render: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testOne' },
                        children: [{ data: { tag: 'String', value: 'First' }, children: [] }]
                    }]
                },
                {
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testTwo' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                }],
                key: 'testFeature',
                stateMapping: {
                    testOne: 'VARIABLE#One',
                    testTwo: 'VARIABLE#Two'
                },
                keyMapping: {}
            },
            Personal: {
                EphemeraId: 'FEATURE#TestOne',
                assetId: 'Base',
                name: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testThree' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                }],
                render: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testThree' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                },
                {
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testFour' },
                        children: [{ data: { tag: 'String', value: 'Second' }, children: [] }]
                    }]
                }],
                key: 'testFeature',
                stateMapping: {
                    testThree: 'VARIABLE#Three',
                    testFour: 'VARIABLE#Four'
                },
                keyMapping: {}
            }
        })
        jest.spyOn(internalCache.EvaluateCode, "get").mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [], SessionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "FEATURE#TestOne")
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('FEATURE#TestOne', ['Base', 'Personal'])
        expect(output).toEqual({
            FeatureId: 'FEATURE#TestOne',
            Name: [{ tag: 'String', value: 'TestFeature' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            assets: {
                ['ASSET#Base']: 'testFeature',
                ['ASSET#Personal']: 'testFeature'
            }
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
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'KNOWLEDGE#TestOne',
                assetId: 'Base',
                name: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testOne' },
                        children: [{ data: { tag: 'String', value: 'TestKnowledge' }, children: [] }]
                    }]
                }],
                render: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testOne' },
                        children: [{ data: { tag: 'String', value: 'First' }, children: [] }]
                    }]
                },
                {
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testTwo' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                }],
                key: 'testKnowledge',
                stateMapping: {
                    testOne: 'VARIABLE#One',
                    testTwo: 'VARIABLE#Two'
                },
                keyMapping: {}
            },
            Personal: {
                EphemeraId: 'KNOWLEDGE#TestOne',
                assetId: 'Base',
                name: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testThree' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                }],
                render: [{
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testThree' },
                        children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                    }]
                },
                {
                    data: { tag: 'If' },
                    children: [{
                        data: { tag: 'Statement', if: 'testFour' },
                        children: [{ data: { tag: 'String', value: 'Second' }, children: [] }]
                    }]
                }],
                key: 'testKnowledge',
                stateMapping: {
                    testThree: 'VARIABLE#Three',
                    testFour: 'VARIABLE#Four'
                },
                keyMapping: {}
            }
        })
        jest.spyOn(internalCache.EvaluateCode, "get").mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [], SessionIds: [] }
        ])
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "KNOWLEDGE#TestOne")
        expect(internalCache.ComponentMeta.getAcrossAssets).toHaveBeenCalledWith('KNOWLEDGE#TestOne', ['Base', 'Personal'])
        expect(output).toEqual({
            KnowledgeId: 'KNOWLEDGE#TestOne',
            Name: [{ tag: 'String', value: 'TestKnowledge' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            assets: {
                ['ASSET#Base']: 'testKnowledge',
                ['ASSET#Personal']: 'testKnowledge'
            }
        })
    })

    it('should render bookmarks correctly', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockImplementation(async (ephemeraId) => {
            switch(ephemeraId) {
                case 'FEATURE#TestOne':
                    return {
                        Base: {
                            EphemeraId: 'FEATURE#TestOne',
                            assetId: 'Base',
                            name: [],
                            render: [{ data: { tag: 'Bookmark', key: 'bookmark1' }, children: [] }],
                            key: 'testFeature',
                            stateMapping: {},
                            keyMapping: { "bookmark1": "BOOKMARK#TestTwo" }
                        }
                    } as any
                case 'BOOKMARK#TestTwo':
                    return {
                        Base: {
                            EphemeraId: 'BOOKMARK#TestTwo',
                            assetId: 'Base',
                            render: [{ data: { tag: 'String', value: 'Test' }, children: [] }],
                            key: 'testBookmark',
                            stateMapping: {},
                            keyMapping: {}
                        }
                    }
                default:
                    throw new Error('Unknown component')
            }
        })
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "FEATURE#TestOne")
        expect(output).toEqual({
            FeatureId: 'FEATURE#TestOne',
            Name: [],
            Description: [{ tag: 'String', value: 'Test' }],
            assets: {
                ['ASSET#Base']: 'testFeature'
            }
        })
    })

    it('should render circular dependent bookmarks with correct error', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockImplementation(async (ephemeraId) => {
            switch(ephemeraId) {
                case 'FEATURE#TestOne':
                    return {
                        Base: {
                            EphemeraId: 'FEATURE#TestOne',
                            assetId: 'Base',
                            name: [],
                            render: [
                                { data: { tag: 'String', value: 'Test' }, children: [] },
                                { data: { tag: 'Bookmark', key: 'bookmark1' }, children: [] }
                            ],
                            key: 'testFeature',
                            stateMapping: {},
                            keyMapping: { "bookmark1": "BOOKMARK#TestTwo" }
                        }
                    } as any
                case 'BOOKMARK#TestTwo':
                    return {
                        Base: {
                            EphemeraId: 'BOOKMARK#TestTwo',
                            assetId: 'Base',
                            render: [
                                { data: { tag: 'String', value: 'Loop' }, children: [] },
                                { data: { tag: 'Bookmark', key: 'bookmark2' }, children: [] }
                            ],
                            key: 'bookmark1',
                            stateMapping: {},
                            keyMapping: { "bookmark2": "BOOKMARK#TestThree" }
                        }
                    }
                case 'BOOKMARK#TestThree':
                    return {
                        Base: {
                            EphemeraId: 'BOOKMARK#TestThree',
                            assetId: 'Base',
                            render: [
                                { data: { tag: 'Bookmark', key: 'bookmark1' }, children: [] }
                            ],
                            key: 'bookmark2',
                            stateMapping: {},
                            keyMapping: { "bookmark1": "BOOKMARK#TestTwo" }
                        }
                    }
                default:
                    throw new Error('Unknown component')
            }
        })
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "FEATURE#TestOne")
        expect(output).toEqual({
            FeatureId: 'FEATURE#TestOne',
            Name: [],
            Description: [{ tag: 'String', value: 'TestLoop#CIRCULAR' }],
            assets: {
                ['ASSET#Base']: 'testFeature'
            }
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
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockImplementation(async (ephemeraId) => {
            switch(ephemeraId) {
                case 'MAP#TestOne':
                    return {
                        Base: {
                            EphemeraId: 'MAP#TestOne',
                            assetId: 'Base',
                            name: [{ data: { tag: 'String', value: 'Test Map' }, children: [] }],
                            images: [{ data: { tag: 'Image', key: 'image1', fileURL: 'https://test.com/test.png' }, children: [] }],
                            rooms: [{ data: { tag: 'Room', key: 'room1' }, children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [] }] }],
                            key: 'testMap',
                            stateMapping: {},
                            keyMapping: { room1: 'ROOM#TestRoomOne' }
                        },
                        Personal: {
                            EphemeraId: 'MAP#TestOne',
                            assetId: 'Personal',
                            name: [],
                            images: [],
                            rooms: [{ data: { tag: 'Room', key: 'room2', x: 100, y: 0 }, children: [{ data: { tag: 'Position', x: 100, y: 0 }, children: [] }] }],
                            key: 'testMap',
                            stateMapping: {},
                            keyMapping: { room2: 'ROOM#TestRoomTwo' }
                        }
                    } as Record<string, ComponentMetaItem & { EphemeraId: EphemeraMapId }>
                case 'ROOM#TestRoomOne':
                    return {
                        Base: {
                            EphemeraId: 'ROOM#TestRoomOne',
                            assetId: 'Base',
                            shortName: [{ data: { tag: 'String', value: 'Test Room One' }, children: [] }],
                            name: [],
                            summary: [],
                            render: [],
                            exits: [
                                { data: { tag: 'Exit', key: 'room1#room2', to: 'room2', from: 'room1' }, children: [{ data: { tag: 'String', value: 'Other Room' }, children: [] }] },
                                { data: { tag: 'Exit', key: 'room1#room3', to: 'room3', from: 'room1' }, children: [{ data: { tag: 'String', value: 'Not in Map' }, children: [] }] }
                            ],
                            key: 'room1',
                            stateMapping: {},
                            keyMapping: { room2: 'ROOM#TestRoomTwo', room3: 'ROOM#TestRoomThree' }
                        },
                        Personal: { EphemeraId: 'ROOM#TestRoomOne', assetId: 'Personal', shortName: [], name: [], summary: [], render: [], exits: [], key: 'room1', stateMapping: {}, keyMapping: {} }
                    } as Record<string, ComponentMetaItem & { EphemeraId: EphemeraRoomId }>
                case 'ROOM#TestRoomTwo':
                    return {
                        Base: { EphemeraId: 'ROOM#TestRoomTwo', assetId: 'Base', shortName: [], name: [], summary: [], render: [], exits: [], key: 'room2', stateMapping: {}, keyMapping: {} },
                        Personal: {
                            EphemeraId: 'ROOM#TestRoomTwo',
                            assetId: 'Personal',
                            shortName: [{ data: { tag: 'String', value: 'Test Room Two' }, children: [] }],
                            name: [],
                            summary: [],
                            render: [],
                            exits: [
                                { data: { tag: 'Exit', key: 'room2#room1', to: 'room1', from: 'room2' }, children: [{ data: { tag: 'String', value: 'First Room' }, children: [] }] }
                            ],
                            key: 'room2',
                            stateMapping: {},
                            keyMapping: { room1: 'ROOM#TestRoomOne' }
                        }
                    }
            }
            throw new Error(`Invalid test EphemeraID: ${ephemeraId}`)
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([])
        jest.spyOn(internalCache.EvaluateCode, "get").mockResolvedValue(false)
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "MAP#TestOne")
        expect(output).toEqual({
            MapId: 'MAP#TestOne',
            name: [{ tag: 'String', value: 'Test Map' }],
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
            ],
            assets: {
                ['ASSET#Base']: 'testMap',
                ['ASSET#Personal']: 'testMap'
            }
        })
    })

    it('should correctly invalidate evaluations on asset state change', async () => {
        jest.spyOn(internalCache.Global, "get").mockResolvedValue(['Base'])
        jest.spyOn(internalCache.CharacterMeta, "get").mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Tess',
            assets: [],
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockImplementation(async (ephemeraId) => {
            switch(ephemeraId) {
                case 'ROOM#TestOne':
                    return {
                        Base: {
                            EphemeraId: 'ROOM#TestOne',
                            assetId: 'Base',
                            shortName: [{ data: { tag: 'String', value: 'TestRoom' }, children: [] }],
                            name: [],
                            summary: [],
                            render: [
                                { data: { tag: 'String', value: 'First' }, children: [] },
                                {
                                    data: { tag: 'If' },
                                    children: [{
                                        data: { tag: 'Statement', if: 'testTwo' },
                                        children: [{ data: { tag: 'String', value: 'Second' }, children: [] }]
                                    }]
                                }
                            ],
                            exits: [],
                            stateMapping: { testTwo: 'VARIABLE#testVariable' },
                            keyMapping: {},
                            key: 'testRoom'
                        }
                    }
            }
            throw new Error(`Undefined test EphemeraId: ${ephemeraId}`)
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [], SessionIds: [] }
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
            ShortName: [{ tag: 'String', value: 'TestRoom' }],
            Name: [],
            Summary: [],
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'First' }],
            Exits: [],
            assets: { ['ASSET#Base']: 'testRoom' }
        })

        internalCache.AssetState.invalidate('VARIABLE#testVariable')
        const outputTwo = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(internalCache.EvaluateCode.get).toHaveBeenCalledTimes(2)
        expect(outputTwo).toEqual({
            RoomId: 'ROOM#TestOne',
            ShortName: [{ tag: 'String', value: 'TestRoom' }],
            Name: [],
            Summary: [],
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            Exits: [],
            assets: { ['ASSET#Base']: 'testRoom' }
        })

        internalCache.AssetState.invalidate('VARIABLE#otherVariable')
        const outputThree = await internalCache.ComponentRender.get('CHARACTER#TESS', 'ROOM#TestOne')
        expect(internalCache.EvaluateCode.get).toHaveBeenCalledTimes(2)
        expect(outputThree).toEqual({
            RoomId: 'ROOM#TestOne',
            ShortName: [{ tag: 'String', value: 'TestRoom' }],
            Name: [],
            Summary: [],
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            Exits: [],
            assets: { ['ASSET#Base']: 'testRoom' }
        })
    })
})