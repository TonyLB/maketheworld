import { EphemeraMapId, EphemeraRoomId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import internalCache from "../internalCache"
import { ComponentMetaItem } from "./componentMeta"
// import { ComponentMetaMapItem, ComponentMetaRoomItem } from '../internalCache/componentMeta'
// import { componentAppearanceReduce } from "./componentRender"

describe('ComponentRender cache handler', () => {
    // describe('componentAppearanceReduce', () => {
    //     const options = {
    //         evaluateConditional: jest.fn().mockResolvedValue(false),
    //         renderBookmark: jest.fn().mockResolvedValue([])
    //     }

    //     beforeEach(() => {
    //         options.renderBookmark.mockClear()
    //         options.renderBookmark.mockRestore()
    //     })
        
    //     it('should return empty from empty string', async () => {
    //         expect(await componentAppearanceReduce(options)).toEqual({
    //             Description: [],
    //             Name: [],
    //             Exits: []
    //         })
    //     })

    //     it('should correctly join render strings', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'String',
    //                 value: 'Test '
    //             },
    //             {
    //                 tag: 'String',
    //                 value: 'One'
    //             }]
    //         })).toEqual({
    //             Description: [{ tag: 'String', value: 'Test One' }],
    //             Name: [],
    //             Exits: []
    //         })
    //     })

    //     it('should correctly join link after string', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'String',
    //                 value: 'Test '
    //             },
    //             {
    //                 tag: 'Link',
    //                 text: 'One',
    //                 to: 'FEATURE#TestOne'
    //             }]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'String', value: 'Test ' },
    //                 { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })

    //     })

    //     it('should correctly join string after link', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'Link',
    //                 text: 'Test',
    //                 to: 'FEATURE#TestOne'
    //             },
    //             {
    //                 tag: 'String',
    //                 value: ' One'
    //             }]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
    //                 { tag: 'String', value: ' One' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })

    //     })

    //     it('should correctly join links with space between', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'Link',
    //                 text: 'Test',
    //                 to: 'FEATURE#TestOne'
    //             },
    //             {
    //                 tag: 'String',
    //                 value: ' '
    //             },
    //             {
    //                 tag: 'Link',
    //                 text: 'One',
    //                 to: 'FEATURE#TestOne'
    //             }]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
    //                 { tag: 'String', value: ' ' },
    //                 { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })

    //     })

    //     it('should correctly join items with line breaks', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'Link',
    //                 text: 'Test',
    //                 to: 'FEATURE#TestOne'
    //             },
    //             {
    //                 tag: 'LineBreak'
    //             },
    //             {
    //                 tag: 'Link',
    //                 text: 'One',
    //                 to: 'FEATURE#TestOne'
    //             }]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'Link', text: 'Test', to: 'FEATURE#TestOne' },
    //                 { tag: 'LineBreak' },
    //                 { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })

    //     })

    //     it('should correctly join items without spacing fields', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'String',
    //                 value: 'Test ',
    //             },
    //             {
    //                 tag: 'Link',
    //                 text: 'One',
    //                 to: 'FEATURE#TestOne'
    //             }]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'String', value: 'Test ' },
    //                 { tag: 'Link', text: 'One', to: 'FEATURE#TestOne' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })

    //     })

    //     it('should correctly evaluate conditionals', async () => {
    //         const testOptions = {
    //             ...options,
    //             evaluateConditional: jest.fn().mockImplementation(async (source) => {
    //                 switch(source) {
    //                     case 'checkOne': return true
    //                     case 'checkTwo': return false
    //                 }
    //             })
    //         }
    //         expect(await componentAppearanceReduce(testOptions, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [
    //                 { tag: 'String', value: 'Show this, ' },
    //                 {
    //                     tag: 'Condition',
    //                     conditions: [{
    //                         if: 'checkOne',
    //                         dependencies: [{ key: 'checkOne', EphemeraId: 'VARIABLE#Test' }]
    //                     }],
    //                     contents: [
    //                         { tag: 'String', value: 'and this, ' },
    //                         {
    //                             tag: 'Condition',
    //                             conditions: [{
    //                                 if: 'checkOne',
    //                                 dependencies: [{ key: 'checkOne', EphemeraId: 'VARIABLE#Test' }]
    //                             }],
    //                             contents: [
    //                                 { tag: 'String', value: `and also this` },
    //                             ]
    //                         },
    //                         {
    //                             tag: 'Condition',
    //                             conditions: [{
    //                                 if: 'checkTwo',
    //                                 dependencies: [{ key: 'checkTwo', EphemeraId: 'VARIABLE#Test' }]
    //                             }],
    //                             contents: [
    //                                 { tag: 'String', value: `but not this` },
    //                             ]
    //                         }
    //                     ]
    //                 },
    //                 {
    //                     tag: 'Condition',
    //                     conditions: [{
    //                         if: 'checkTwo',
    //                         dependencies: [{ key: 'checkTwo', EphemeraId: 'VARIABLE#Test' }]
    //                     }],
    //                     contents: [
    //                         { tag: 'String', value: `and not this` },
    //                     ]
    //                 },
    //                 { tag: 'String', value: '.' }
    //             ]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'String', value: 'Show this, and this, and also this.' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })
    //     })

    //     it('should correctly parse into after tag', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'String',
    //                 value: 'One ',
    //             },
    //             {
    //                 tag: 'After',
    //                 contents: [
    //                     { tag: 'String', value: 'Two ' },
    //                     { tag: 'String', value: 'Three' }
    //                 ]
    //             }]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'String', value: 'One Two Three' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })

    //     })

    //     it('should correctly parse into before tag', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'String',
    //                 value: 'Three',
    //             },
    //             {
    //                 tag: 'Before',
    //                 contents: [
    //                     { tag: 'String', value: 'One ' },
    //                     { tag: 'String', value: 'Two ' }
    //                 ]
    //             }]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'String', value: 'One Two Three' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })

    //     })

    //     it('should correctly parse into replace tag', async () => {
    //         expect(await componentAppearanceReduce(options, {
    //             conditions: [],
    //             name: [],
    //             exits: [],
    //             render: [{
    //                 tag: 'String',
    //                 value: 'Uno Dos ',
    //             },
    //             {
    //                 tag: 'Replace',
    //                 contents: [
    //                     { tag: 'String', value: 'One ' },
    //                     { tag: 'String', value: 'Two ' }
    //                 ]
    //             },
    //             {
    //                 tag: 'String',
    //                 value: 'Three'
    //             }]
    //         })).toEqual({
    //             Description: [
    //                 { tag: 'String', value: 'One Two Three' }
    //             ],
    //             Name: [],
    //             Exits: []
    //         })

    //     })

    // })

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
                name: [{
                    data: { tag: 'If', conditions: [{ if: 'testOne' }] },
                    children: [{ data: { tag: 'String', value: 'TestRoom' }, children: [] }]
                }],
                render: [{
                    data: { tag: 'If', conditions: [{ if: 'testOne' }] },
                    children: [{ data: { tag: 'String', value: 'First' }, children: [] }]
                },
                {
                    data: { tag: 'If', conditions: [{ if: 'testTwo' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
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
                name: [{
                    data: { tag: 'If', conditions: [{ if: 'testThree' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                }],
                render: [{
                    data: { tag: 'If', conditions: [{ if: 'testThree' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                },
                {
                    data: { tag: 'If', conditions: [{ if: 'testFour' }] },
                    children: [{ data: { tag: 'String', value: 'Second' }, children: [] }]
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
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'FEATURE#TestOne',
                assetId: 'Base',
                name: [{
                    data: { tag: 'If', conditions: [{ if: 'testOne' }] },
                    children: [{ data: { tag: 'String', value: 'TestFeature' }, children: [] }]
                }],
                render: [{
                    data: { tag: 'If', conditions: [{ if: 'testOne' }] },
                    children: [{ data: { tag: 'String', value: 'First' }, children: [] }]
                },
                {
                    data: { tag: 'If', conditions: [{ if: 'testTwo' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
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
                    data: { tag: 'If', conditions: [{ if: 'testThree' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                }],
                render: [{
                    data: { tag: 'If', conditions: [{ if: 'testThree' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                },
                {
                    data: { tag: 'If', conditions: [{ if: 'testFour' }] },
                    children: [{ data: { tag: 'String', value: 'Second' }, children: [] }]
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
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            Pronouns: { subject: 'she', object: 'her', possessive: 'her', adjective: 'hers', reflexive: 'herself' }
        })
        jest.spyOn(internalCache.ComponentMeta, "getAcrossAssets").mockResolvedValue({
            Base: {
                EphemeraId: 'KNOWLEDGE#TestOne',
                assetId: 'Base',
                name: [{
                    data: { tag: 'If', conditions: [{ if: 'testOne' }] },
                    children: [{ data: { tag: 'String', value: 'TestKnowledge' }, children: [] }]
                }],
                render: [{
                    data: { tag: 'If', conditions: [{ if: 'testOne' }] },
                    children: [{ data: { tag: 'String', value: 'First' }, children: [] }]
                },
                {
                    data: { tag: 'If', conditions: [{ if: 'testTwo' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
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
                    data: { tag: 'If', conditions: [{ if: 'testThree' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                }],
                render: [{
                    data: { tag: 'If', conditions: [{ if: 'testThree' }] },
                    children: [{ data: { tag: 'String', value: 'ERROR' }, children: [] }]
                },
                {
                    data: { tag: 'If', conditions: [{ if: 'testFour' }] },
                    children: [{ data: { tag: 'String', value: 'Second' }, children: [] }]
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
                            rooms: [{ data: { tag: 'Room', key: 'room1', x: 0, y:0 }, children: [] }],
                            key: 'testMap',
                            stateMapping: {},
                            keyMapping: { room1: 'ROOM#TestRoomOne' }
                        },
                        Personal: {
                            EphemeraId: 'MAP#TestOne',
                            assetId: 'Personal',
                            name: [],
                            images: [],
                            rooms: [{ data: { tag: 'Room', key: 'room2', x: 100, y: 0 }, children: [] }],
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
                            name: [{ data: { tag: 'String', value: 'Test Room One' }, children: [] }],
                            render: [],
                            exits: [
                                { data: { tag: 'Exit', key: 'room1#room2', to: 'room2', from: 'room1', name: 'Other Room' }, children: [] },
                                { data: { tag: 'Exit', key: 'room1#room3', to: 'room3', from: 'room1', name: 'Not in Map' }, children: [] }
                            ],
                            key: 'room1',
                            stateMapping: {},
                            keyMapping: { room2: 'ROOM#TestRoomTwo', room3: 'ROOM#TestRoomThree' }
                        },
                        Personal: { EphemeraId: 'ROOM#TestRoomOne', assetId: 'Personal', name: [], render: [], exits: [], key: 'testMap', stateMapping: {}, keyMapping: {} }
                    } as Record<string, ComponentMetaItem & { EphemeraId: EphemeraRoomId }>
                case 'ROOM#TestRoomTwo':
                    return {
                        Base: { EphemeraId: 'ROOM#TestRoomTwo', assetId: 'Base', name: [], render: [], exits: [], key: 'testMap', stateMapping: {}, keyMapping: {} },
                        Personal: {
                            EphemeraId: 'ROOM#TestRoomTwo',
                            assetId: 'Personal',
                            name: [{ data: { tag: 'String', value: 'Test Room Two' }, children: [] }],
                            render: [],
                            exits: [
                                { data: { tag: 'Exit', key: 'room2#room1', to: 'room1', from: 'room2', name: 'First Room' }, children: [] }
                            ],
                            key: 'testMap',
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
            Name: [{ tag: 'String', value: 'Test Map' }],
            fileURL: 'https://test.com/test.png',
            rooms: [
                {
                    roomId: 'ROOM#TestRoomOne',
                    name: [{ tag: 'String', value: 'Test Room One' }],
                    x: 0,
                    y: 0,
                    exits: [{
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
                            name: [{ data: { tag: 'String', value: 'TestRoom' }, children: [] }],
                            render: [
                                { data: { tag: 'String', value: 'First' }, children: [] },
                                {
                                    data: { tag: 'If', conditions: [{ if: 'testTwo' }] },
                                    children: [{ data: { tag: 'String', value: 'Second' }, children: [] }]
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