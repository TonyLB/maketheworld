import produce from "immer"
import { updateSchema, updateStandard } from "./reducers"
import { Standardizer } from "@tonylb/mtw-wml/dist/standardize"
import { GenericTree, TreeId } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"

describe('personalAsset slice reducers', () => {
    describe('updateSchema', () => {
        it('should replace schema content', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: '',
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'DEF', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]}
                        ]
                    }
                ]
            }]
            expect(produce({ baseSchema: testSchema, importData: [] }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'replace',
                    id: 'DEF',
                    item: {
                        data: { tag: 'Name' },
                        id: 'DEF',
                        children: [{
                            data: { tag: 'String', value: 'Test Update' },
                            children: []
                        }]
                    }
                }
            })).baseSchema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Update' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]}
                        ]
                    }
                ]    
            }])
        })

        it('should add children', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'DEF', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: 'UUID2', children: [] }]}
                        ]
                    }
                ]
            }]
            expect(produce({ baseSchema: testSchema, importData: [] }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'addChild',
                    id: 'DEF',
                    item: {
                        data: { tag: 'String', value: ': Edited' },
                        children: []
                    }
                }
            })).baseSchema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: expect.any(String),
                        children: [
                            {
                                data: { tag: 'Name' },
                                id: expect.any(String),
                                children: [
                                    { data: { tag: 'String', value: 'Test Room' }, id: expect.any(String), children: [] },
                                    { data: { tag: 'String', value: ': Edited' }, id: expect.any(String), children: [] },
                                ]
                            },
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]}
                        ]
                    }
                ]    
            }])
        })

        it('should delete schema content', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: '',
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'DEF', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]}
                        ]
                    }
                ]
            }]
            expect(produce({ baseSchema: testSchema, importData: [] }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'delete',
                    id: 'DEF'
                }
            })).baseSchema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]}
                        ]
                    }
                ]
            }])
        })

        it('should update a schemaTag without changing its children', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: '',
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            {
                                data: { tag: 'Name' },
                                id: 'DEF',
                                children: [{
                                    data: { tag: 'If' },
                                    id: 'IF-Wrapper',
                                    children: [{
                                        data: { tag: 'Statement', if: 'true', selected: false },
                                        id: 'IF-1',
                                        children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]
                                    }]
                                }]
                            },
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]}
                        ]
                    }
                ]
            }]
            expect(produce({ baseSchema: testSchema, importData: [] }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'updateNode',
                    id: 'ABC',
                    item: { tag: 'Room', key: 'lobby' }
                }
            })).baseSchema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'lobby' },
                        id: expect.any(String),
                        children: [
                            {
                                data: { tag: 'Name' },
                                id: expect.any(String),
                                children: [{
                                    data: { tag: 'If' },
                                    id: expect.any(String),
                                    children: [{
                                        data: { tag: 'Statement', if: 'true', selected: false },
                                        id: expect.any(String),
                                        children: [{ data: { tag: 'String', value: 'Test Room' }, id: expect.any(String), children: [] }]
                                    }]
                                }]
                            },
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]}
                        ]
                    }
                ]
            }])
        })

        it('should rename exit targets on rename of room', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Room', key: 'room2' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Garden' }, id: 'UUID3', children: [] }]},
                            { data: { tag: 'Exit', to: 'testRoom', text: 'lobby' }, id: 'UUID4', children: [] }
                        ]
                    },
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID5', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: 'UUID6', children: [] }]},
                            { data: { tag: 'Exit', to: 'room2', text: 'out' }, id: 'UUID7', children: [] }
                        ]
                    }
                ]
            }]
            expect(produce({ baseSchema: testSchema, importData: [] }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'rename',
                    fromKey: 'room2',
                    toKey: 'garden'
                }
            })).baseSchema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Room', key: 'garden' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Garden' }, id: 'UUID3', children: [] }]},
                            { data: { tag: 'Exit', to: 'testRoom', text: 'lobby' }, id: 'UUID4', children: [] }
                        ]
                    },
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID5', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: 'UUID6', children: [] }]},
                            { data: { tag: 'Exit', to: 'garden', text: 'out' }, id: 'UUID7', children: [] }
                        ]
                    }
                ]
            }])
        })

        it('should rename link targets on rename of feature', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Feature', key: 'feature1' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Test Feature' }, id: 'GHI', children: [] }]},
                            {
                                data: { tag: 'Description' },
                                id: 'JKL',
                                children: [{
                                    data: { tag: 'Link', to: 'feature1' },
                                    id: 'UUID3',
                                    children: [
                                        { data: { tag: 'String', value: 'Link' }, id: 'UUID4', children: [] }
                                    ]
                                }]
                            },
                        ]
                    }
                ]
            }]
            const testOutput = produce({ baseSchema: testSchema, importData: [] }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'rename',
                    fromKey: 'feature1',
                    toKey: 'clockTower'
                }
            }))
            expect(testOutput.baseSchema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Feature', key: 'clockTower' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Test Feature' }, id: 'GHI', children: [] }]},
                            {
                                data: { tag: 'Description' },
                                id: 'JKL',
                                children: [{
                                    data: { tag: 'Link', to: 'clockTower' },
                                    id: 'UUID3',
                                    children: [
                                        { data: { tag: 'String', value: 'Link' }, id: 'UUID4', children: [] }
                                    ]
                                }]
                            },
                        ]
                    }
                ]
            }])
        })        
    })

    describe('updateStandard', () => {
        it('should replace schema content', () => {
            const testSchema = [{
                data: { tag: 'Asset' as const, key: 'testAsset', Story: undefined },
                id: '',
                children: [
                    {
                        data: { tag: 'Room' as const, key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' as const }, id: 'DEF', children: [{ data: { tag: 'String' as const, value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' as const }, id: 'JKL', children: [{ data: { tag: 'String' as const, value: 'Test Description' }, id: '', children: [] }]}
                        ]
                    }
                ]
            }]
            const standardize = new Standardizer(testSchema)
            expect(produce(
                {
                    schema: testSchema,
                    standard: standardize.standardForm,
                    inherited: { key: 'testAsset', tag: 'Asset', byId: {}, metaData: [] }
                },
                (state) => updateStandard(state as any, {
                    type: 'updateStandard',
                    payload: {
                        type: 'replaceItem',
                        componentKey: 'testRoom',
                        itemKey: 'name',
                        item: { data: { tag: 'Name' }, children: [{ data: { tag: 'String', value: 'Test Update' }, children: [] }]}
                    }
                })
            ).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Update' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]}
                        ]
                    }
                ]    
            }])
        })

        it('should add a component', () => {
            const testSchema: GenericTree<SchemaTag, TreeId> = [{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'DEF', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: 'UUID2', children: [] }]}
                        ]
                    }
                ]
            }]
            const standardize = new Standardizer(testSchema)
            expect(produce(
                {
                    schema: testSchema,
                    standard: standardize.standardForm,
                    inherited: { key: 'testAsset', tag: 'Asset', byId: {}, metaData: [] }
                },
                (state) => updateStandard(state as any, {
                    type: 'updateStandard',
                    payload: {
                        type: 'addComponent',
                        tag: 'Variable'
                    }
                })
            ).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: expect.any(String),
                        children: [
                            {
                                data: { tag: 'Name' },
                                id: expect.any(String),
                                children: [{ data: { tag: 'String', value: 'Test Room' }, id: expect.any(String), children: [] }]
                            },
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]}
                        ]
                    },
                    {
                        data: { tag: 'Variable', key: 'Variable1', default: 'false' },
                        id: expect.any(String),
                        children: []
                    }
                ]    
            }])
        })

        it('should splice a component list', () => {
            const testSchema: GenericTree<SchemaTag, TreeId> = [{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'DEF', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: 'UUID2', children: [] }]},
                            { data: { tag: 'Exit', key: 'testRoom#testDestination', from: 'testRoom', to: 'testDestination' }, id: 'MNO', children: [{ data: { tag: 'String', value: 'out' }, id: '', children: [] }]}
                        ]
                    },
                    {
                        data: { tag: 'Room', key: 'testDestination' },
                        id: 'PQR',
                        children: []
                    }
                ]
            }]
            const standardize = new Standardizer(testSchema)

            //
            // Test removing an item from a list
            //
            expect(produce(
                {
                    schema: testSchema,
                    standard: standardize.standardForm,
                    inherited: { key: 'testAsset', tag: 'Asset', byId: {}, metaData: [] }
                },
                (state) => updateStandard(state as any, {
                    type: 'updateStandard',
                    payload: {
                        type: 'spliceList',
                        componentKey: 'testRoom',
                        itemKey: 'exits',
                        at: 0,
                        replace: 1,
                        items: []
                    }
                })
            ).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testDestination' },
                        id: expect.any(String),
                        children: []
                    },
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Room' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]},
                        ]
                    }
                ]
            }])

            //
            // Test replacing an item in a list
            //
            expect(produce(
                {
                    schema: testSchema,
                    standard: standardize.standardForm,
                    inherited: { key: 'testAsset', tag: 'Asset', byId: {}, metaData: [] }
                },
                (state) => updateStandard(state as any, {
                    type: 'updateStandard',
                    payload: {
                        type: 'spliceList',
                        componentKey: 'testRoom',
                        itemKey: 'exits',
                        at: 0,
                        replace: 1,
                        items: [{ data: { tag: 'Exit', key: 'testRoom#testDestination', from: 'testRoom', to: 'testDestination' }, children: [{ data: { tag: 'String', value: 'depart' }, children: [] }]}]
                    }
                })
            ).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testDestination' },
                        id: expect.any(String),
                        children: []
                    },
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Room' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Exit', key: 'testRoom#testDestination', from: 'testRoom', to: 'testDestination' }, children: [{ data: { tag: 'String', value: 'depart' }, children: [] }]}
                        ]
                    }
                ]
            }])
        })

        it('should delete schema content', () => {
            const testSchema = [{
                data: { tag: 'Asset' as const, key: 'testAsset', Story: undefined },
                id: '',
                children: [
                    {
                        data: { tag: 'Room' as const, key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' as const }, id: 'DEF', children: [{ data: { tag: 'String' as const, value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' as const }, id: 'JKL', children: [{ data: { tag: 'String' as const, value: 'Test Description' }, id: '', children: [] }]}
                        ]
                    }
                ]
            }]
            const standardize = new Standardizer(testSchema)
            expect(produce(
                {
                    schema: testSchema,
                    standard: standardize.standardForm,
                    inherited: { key: 'testAsset', tag: 'Asset', byId: {}, metaData: [] }
                },
                (state) => updateStandard(state as any, {
                    type: 'updateStandard',
                    payload: {
                        type: 'replaceItem',
                        componentKey: 'testRoom',
                        itemKey: 'name',
                        item: undefined
                    }
            })).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]}
                        ]
                    }
                ]
            }])
        })

        it('should update a non-tree field in a standardComponent', () => {
            const testSchema: GenericTree<SchemaTag, TreeId> = [{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
                id: '',
                children: [
                    {
                        data: { tag: 'Computed', key: 'testComputed', src: '!testVar' },
                        id: 'ABC',
                        children: []
                    }
                ]
            }]
            const standardize = new Standardizer(testSchema)
            expect(produce(
                {
                    schema: testSchema,
                    standard: standardize.standardForm,
                    inherited: { key: 'testAsset', tag: 'Asset', byId: {}, metaData: [] }
                },
                (state) => updateStandard(state as any, {
                    type: 'updateStandard',
                    payload: {
                        type: 'updateField',
                        componentKey: 'testComputed',
                        itemKey: 'src',
                        value: 'testVar'
                    }
            })).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Computed', key: 'testComputed', src: 'testVar' },
                        id: 'ABC',
                        children: []
                    }
                ]
            }])
        })


        it('should replace metaData', () => {
            const testSchema: GenericTree<SchemaTag, TreeId> = [{
                data: { tag: 'Character', key: 'testCharacter', Pronouns: { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
                id: '',
                children: [
                    {
                        data: { tag: 'Import', from: 'testImport', mapping: {} },
                        id: 'DEF',
                        children: []
                    }
                ]
            }]
            const standardize = new Standardizer(testSchema)
            expect(produce(
                {
                    schema: testSchema,
                    standard: standardize.standardForm,
                    inherited: { key: 'testCharacter', tag: 'Character', byId: {}, metaData: [] }
                },
                (state) => updateStandard(state as any, {
                    type: 'updateStandard',
                    payload: {
                        type: 'replaceMetaData',
                        metaData: [{
                            data: { tag: 'Import', from: 'differentImport', mapping: {} },
                            children: []
                        }]
                    }
            })).schema).toEqual([{
                data: { tag: 'Character', key: 'testCharacter', Pronouns: { subject: 'they', object: 'them', possessive: 'theirs', adjective: 'their', reflexive: 'themself' } },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Import', from: 'differentImport', mapping: {} },
                        id: expect.any(String),
                        children: []
                    }
                ]
            }])
        })

        // it('should rename exit targets on rename of room', () => {
        //     const testSchema = [{
        //         data: { tag: 'Asset', key: 'testAsset' },
        //         id: 'UUID1',
        //         children: [
        //             {
        //                 data: { tag: 'Room', key: 'room2' },
        //                 id: 'ABC',
        //                 children: [
        //                     { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Garden' }, id: 'UUID3', children: [] }]},
        //                     { data: { tag: 'Exit', to: 'testRoom', text: 'lobby' }, id: 'UUID4', children: [] }
        //                 ]
        //             },
        //             {
        //                 data: { tag: 'Room', key: 'testRoom' },
        //                 id: 'ABC',
        //                 children: [
        //                     { data: { tag: 'Name' }, id: 'UUID5', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
        //                     { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: 'UUID6', children: [] }]},
        //                     { data: { tag: 'Exit', to: 'room2', text: 'out' }, id: 'UUID7', children: [] }
        //                 ]
        //             }
        //         ]
        //     }]
        //     expect(produce({ baseSchema: testSchema, importData: [] }, (state) => updateSchema(state as any, {
        //         type: 'updateSchema',
        //         payload: {
        //             type: 'rename',
        //             fromKey: 'room2',
        //             toKey: 'garden'
        //         }
        //     })).baseSchema).toEqual([{
        //         data: { tag: 'Asset', key: 'testAsset' },
        //         id: 'UUID1',
        //         children: [
        //             {
        //                 data: { tag: 'Room', key: 'garden' },
        //                 id: 'ABC',
        //                 children: [
        //                     { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Garden' }, id: 'UUID3', children: [] }]},
        //                     { data: { tag: 'Exit', to: 'testRoom', text: 'lobby' }, id: 'UUID4', children: [] }
        //                 ]
        //             },
        //             {
        //                 data: { tag: 'Room', key: 'testRoom' },
        //                 id: 'ABC',
        //                 children: [
        //                     { data: { tag: 'Name' }, id: 'UUID5', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
        //                     { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: 'UUID6', children: [] }]},
        //                     { data: { tag: 'Exit', to: 'garden', text: 'out' }, id: 'UUID7', children: [] }
        //                 ]
        //             }
        //         ]
        //     }])
        // })

        // it('should rename link targets on rename of feature', () => {
        //     const testSchema = [{
        //         data: { tag: 'Asset', key: 'testAsset' },
        //         id: 'UUID1',
        //         children: [
        //             {
        //                 data: { tag: 'Feature', key: 'feature1' },
        //                 id: 'ABC',
        //                 children: [
        //                     { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Test Feature' }, id: 'GHI', children: [] }]},
        //                     {
        //                         data: { tag: 'Description' },
        //                         id: 'JKL',
        //                         children: [{
        //                             data: { tag: 'Link', to: 'feature1' },
        //                             id: 'UUID3',
        //                             children: [
        //                                 { data: { tag: 'String', value: 'Link' }, id: 'UUID4', children: [] }
        //                             ]
        //                         }]
        //                     },
        //                 ]
        //             }
        //         ]
        //     }]
        //     const testOutput = produce({ baseSchema: testSchema, importData: [] }, (state) => updateSchema(state as any, {
        //         type: 'updateSchema',
        //         payload: {
        //             type: 'rename',
        //             fromKey: 'feature1',
        //             toKey: 'clockTower'
        //         }
        //     }))
        //     expect(testOutput.baseSchema).toEqual([{
        //         data: { tag: 'Asset', key: 'testAsset' },
        //         id: 'UUID1',
        //         children: [
        //             {
        //                 data: { tag: 'Feature', key: 'clockTower' },
        //                 id: 'ABC',
        //                 children: [
        //                     { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Test Feature' }, id: 'GHI', children: [] }]},
        //                     {
        //                         data: { tag: 'Description' },
        //                         id: 'JKL',
        //                         children: [{
        //                             data: { tag: 'Link', to: 'clockTower' },
        //                             id: 'UUID3',
        //                             children: [
        //                                 { data: { tag: 'String', value: 'Link' }, id: 'UUID4', children: [] }
        //                             ]
        //                         }]
        //                     },
        //                 ]
        //             }
        //         ]
        //     }])
        // })        
    })
})