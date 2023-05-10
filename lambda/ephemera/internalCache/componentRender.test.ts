import internalCache from "../internalCache"
import { ComponentMetaMapItem, ComponentMetaRoomItem } from '../internalCache/componentMeta'
import { componentAppearanceReduce } from "./componentRender"

describe('ComponentRender cache handler', () => {
    describe('componentAppearanceReduce', () => {
        const options = {
            evaluateConditional: jest.fn().mockResolvedValue(false),
            renderBookmark: jest.fn().mockResolvedValue([])
        }
        it('should return empty from empty string', async () => {
            expect(await componentAppearanceReduce(options)).toEqual({
                Description: [],
                Name: [],
                Exits: []
            })
        })

        it('should correctly join render strings', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test '
                },
                {
                    tag: 'String',
                    value: 'One'
                }]
            })).toEqual({
                Description: [{ tag: 'String', value: 'Test One' }],
                Name: [],
                Exits: []
            })
        })

        it('should correctly join link after string', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test '
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne'
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly join string after link', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'Link',
                    text: 'Test',
                    to: 'FEATURE#TestOne'
                },
                {
                    tag: 'String',
                    value: ' One'
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
                    { tag: 'String', value: ' One' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly join links with space between', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'Link',
                    text: 'Test',
                    to: 'FEATURE#TestOne'
                },
                {
                    tag: 'String',
                    value: ' '
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne'
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
                    { tag: 'String', value: ' ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly join items with line breaks', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'Link',
                    text: 'Test',
                    to: 'FEATURE#TestOne'
                },
                {
                    tag: 'LineBreak'
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne'
                }]
            })).toEqual({
                Description: [
                    { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
                    { tag: 'LineBreak' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly join items without spacing fields', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Test ',
                },
                {
                    tag: 'Link',
                    text: 'One',
                    to: 'FEATURE#TestOne'
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Test ' },
                    { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly evaluate conditionals', async () => {
            const testOptions = {
                ...options,
                evaluateConditional: jest.fn().mockImplementation(async (source) => {
                    switch(source) {
                        case 'checkOne': return true
                        case 'checkTwo': return false
                    }
                })
            }
            expect(await componentAppearanceReduce(testOptions, {
                conditions: [],
                name: [],
                exits: [],
                render: [
                    { tag: 'String', value: 'Show this, ' },
                    {
                        tag: 'Condition',
                        conditions: [{
                            if: 'checkOne',
                            dependencies: [{ key: 'checkOne', EphemeraId: 'VARIABLE#Test' }]
                        }],
                        contents: [
                            { tag: 'String', value: 'and this, ' },
                            {
                                tag: 'Condition',
                                conditions: [{
                                    if: 'checkOne',
                                    dependencies: [{ key: 'checkOne', EphemeraId: 'VARIABLE#Test' }]
                                }],
                                contents: [
                                    { tag: 'String', value: `and also this` },
                                ]
                            },
                            {
                                tag: 'Condition',
                                conditions: [{
                                    if: 'checkTwo',
                                    dependencies: [{ key: 'checkTwo', EphemeraId: 'VARIABLE#Test' }]
                                }],
                                contents: [
                                    { tag: 'String', value: `but not this` },
                                ]
                            }
                        ]
                    },
                    {
                        tag: 'Condition',
                        conditions: [{
                            if: 'checkTwo',
                            dependencies: [{ key: 'checkTwo', EphemeraId: 'VARIABLE#Test' }]
                        }],
                        contents: [
                            { tag: 'String', value: `and not this` },
                        ]
                    },
                    { tag: 'String', value: '.' }
                ]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'Show this, and this, and also this.' }
                ],
                Name: [],
                Exits: []
            })
        })

        it('should correctly parse into after tag', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'One ',
                },
                {
                    tag: 'After',
                    contents: [
                        { tag: 'String', value: 'Two ' },
                        { tag: 'String', value: 'Three' }
                    ]
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'One Two Three' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly parse into before tag', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Three',
                },
                {
                    tag: 'Before',
                    contents: [
                        { tag: 'String', value: 'One ' },
                        { tag: 'String', value: 'Two ' }
                    ]
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'One Two Three' }
                ],
                Name: [],
                Exits: []
            })

        })

        it('should correctly parse into replace tag', async () => {
            expect(await componentAppearanceReduce(options, {
                conditions: [],
                name: [],
                exits: [],
                render: [{
                    tag: 'String',
                    value: 'Uno Dos ',
                },
                {
                    tag: 'Replace',
                    contents: [
                        { tag: 'String', value: 'One ' },
                        { tag: 'String', value: 'Two ' }
                    ]
                },
                {
                    tag: 'String',
                    value: 'Three'
                }]
            })).toEqual({
                Description: [
                    { tag: 'String', value: 'One Two Three' }
                ],
                Name: [],
                Exits: []
            })

        })

    })

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
                        name: [{ tag: 'String', value: 'TestRoom' }],
                        render: [{ tag: 'String', value: 'First' }],
                        exits: []
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [] }],
                        name: [],
                        render: [{ tag: 'String', value: 'ERROR' }],
                        exits: []
                    }
                ],
                key: 'testRoom'
            },
            Personal: {
                EphemeraId: 'ROOM#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testThree', dependencies: [] }],
                        name: [{ tag: 'String', value: 'ERROR' }],
                        render: [{ tag: 'String', value: 'ERROR' }],
                        exits: []
                    },
                    {
                        conditions: [{ if: 'testFour', dependencies: [] }],
                        name: [],
                        render: [{ tag: 'String', value: 'Second' }],
                        exits: []
                    }
                ],
                key: 'testRoom'
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
            Name: [{ tag: 'String', value: 'TestRoom' }],
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
                        name: [{ tag: 'String', value: 'TestFeature' }],
                        render: [{ tag: 'String', value: 'First' }],
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [] }],
                        name: [],
                        render: [{ tag: 'String', value: 'ERROR' }],
                    }
                ],
                key: 'testFeature'
            },
            Personal: {
                EphemeraId: 'FEATURE#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testThree', dependencies: [] }],
                        name: [{ tag: 'String', value: 'ERROR' }],
                        render: [{ tag: 'String', value: 'ERROR' }],
                    },
                    {
                        conditions: [{ if: 'testFour', dependencies: [] }],
                        name: [],
                        render: [{ tag: 'String', value: 'Second' }],
                    }
                ],
                key: 'testFeature'
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
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'KNOWLEDGE#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testOne', dependencies: [] }],
                        name: [{ tag: 'String', value: 'TestKnowledge' }],
                        render: [{ tag: 'String', value: 'First' }],
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [] }],
                        name: [],
                        render: [{ tag: 'String', value: 'ERROR' }],
                    }
                ],
                key: 'testKnowledge'
            },
            Personal: {
                EphemeraId: 'KNOWLEDGE#TestOne',
                assetId: 'Base',
                appearances: [
                    {
                        conditions: [{ if: 'testThree', dependencies: [] }],
                        name: [{ tag: 'String', value: 'ERROR' }],
                        render: [{ tag: 'String', value: 'ERROR' }],
                    },
                    {
                        conditions: [{ if: 'testFour', dependencies: [] }],
                        name: [],
                        render: [{ tag: 'String', value: 'Second' }],
                    }
                ],
                key: 'testKnowledge'
            }
        })
        jest.spyOn(internalCache.EvaluateCode, "get").mockImplementation(async ({ source }) => {
            return Boolean(['testOne', 'testFour'].includes(source))
        })
        jest.spyOn(internalCache.RoomCharacterList, "get").mockResolvedValue([
            { EphemeraId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple', ConnectionIds: [] }
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
                    name: [{ tag: 'String', value: 'Test Map' }],
                    fileURL: 'https://test.com/test.png',
                    rooms: [
                        {
                            conditions: [],
                            EphemeraId: 'ROOM#TestRoomOne',
                            x: 0,
                            y: 0
                        }
                    ]
                }],
                key: 'testMap'
            },
            Personal: {
                EphemeraId: 'MAP#TestOne',
                assetId: 'Personal',
                appearances: [{
                    conditions: [],
                    name: [],
                    fileURL: '',
                    rooms: [
                        {
                            conditions: [],
                            EphemeraId: 'ROOM#TestRoomTwo',
                            x: 100,
                            y: 0
                        }
                    ]
                }],
                key: 'testMap'
            }
        } as Record<string, ComponentMetaMapItem>).mockResolvedValueOnce({
            Base: {
                EphemeraId: 'ROOM#TestRoomOne',
                assetId: 'Base',
                appearances: [{
                    conditions: [],
                    name: [{ tag: 'String', value: 'Test Room One' }],
                    render: [],
                    exits: [
                        {
                            conditions: [],
                            to: 'ROOM#TestRoomTwo',
                            name: 'Other Room'
                        },
                        {
                            conditions: [],
                            to: 'ROOM#TestRoomThree',
                            name: 'Not in Map'
                        }
                    ]
                }],
                key: 'testMap'
            },
            Personal: { EphemeraId: 'ROOM#TestRoomOne', assetId: 'Personal', appearances: [], key: 'testMap' }
        } as Record<string, ComponentMetaRoomItem>).mockResolvedValueOnce({
            Base: { EphemeraId: 'ROOM#TestRoomOne', assetId: 'Base', appearances: [], key: 'testMap' },
            Personal: {
                EphemeraId: 'ROOM#TestRoomTwo',
                assetId: 'Personal',
                appearances: [{
                    conditions: [],
                    name: [{ tag: 'String', value: 'Test Room Two' }],
                    render: [],
                    exits: [
                        {
                            conditions: [],
                            to: 'ROOM#TestRoomOne',
                            name: 'First Room'
                        }
                    ]
                }],
                key: 'testMap'
            }
        } as Record<string, ComponentMetaRoomItem>)
        const output = await internalCache.ComponentRender.get("CHARACTER#TESS", "MAP#TestOne")
        expect(output).toEqual({
            MapId: 'MAP#TestOne',
            Name: [{ tag: 'String', value: 'Test Map' }],
            fileURL: 'https://test.com/test.png',
            rooms: [
                {
                    roomId: 'ROOM#TestRoomOne',
                    name: [{ tag: 'String', value: 'Test Room One' }],
                    x: 0,
                    y: 0,
                    exits: [{
                        conditions: [],
                        to: 'ROOM#TestRoomTwo',
                        name: 'Other Room'
                    }]
                },
                {
                    roomId: 'ROOM#TestRoomTwo',
                    name: [{ tag: 'String', value: 'Test Room Two' }],
                    x: 100,
                    y: 0,
                    exits: [{
                        conditions: [],
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
                        name: [{ tag: 'String', value: 'TestRoom' }],
                        render: [{ tag: 'String', value: 'First' }],
                        exits: []
                    },
                    {
                        conditions: [{ if: 'testTwo', dependencies: [{ key: 'testTwo', EphemeraId: 'VARIABLE#testVariable' }] }],
                        name: [],
                        render: [{ tag: 'String', value: 'Second' }],
                        exits: []
                    }
                ],
                key: 'testRoom'
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
            Name: [{ tag: 'String', value: 'TestRoom' }],
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
            Name: [{ tag: 'String', value: 'TestRoom' }],
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
            Name: [{ tag: 'String', value: 'TestRoom' }],
            Characters: [{ CharacterId: 'CHARACTER#TESS', Name: 'Tess', Color: 'purple' }],
            Description: [{ tag: 'String', value: 'FirstSecond' }],
            Exits: [],
            assets: { ['ASSET#Base']: 'testRoom' }
        })
    })
})