import produce from "immer"
import { updateStandard } from "./reducers"
import { Standardizer } from "@tonylb/mtw-wml/dist/standardize"
import { GenericTree, TreeId, treeNodeTypeguard } from "@tonylb/mtw-wml/dist/tree/baseClasses"
import { isSchemaExit, isSchemaString, SchemaTag } from "@tonylb/mtw-wml/dist/schema/baseClasses"

describe('personalAsset slice reducers', () => {

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

        it('should replace schema content using an immer produce', () => {
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
                        itemKey: 'description',
                        produce: (draft) => {
                            draft.children.filter(treeNodeTypeguard(isSchemaString)).forEach((node) => {
                                node.data.value = 'Functional update'
                            })
                        }
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
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Room' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Functional update' }, id: expect.any(String), children: [] }]}
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

        it('should splice a component list with immer producer', () => {
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
            // Test updating a targeted item in a list
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
                        items: [],
                        produce: (draft) => {
                            draft.filter(treeNodeTypeguard(isSchemaExit)).forEach((node) => {
                                node.children.filter(treeNodeTypeguard(isSchemaString)).forEach(({ data }) => { data.value = 'Test Update' })
                            })
                        }
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
                            { data: { tag: 'Exit', key: 'testRoom#testDestination', from: 'testRoom', to: 'testDestination' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Update' }, id: expect.any(String), children: [] }]}
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

        it('should rename exit targets on rename of room', () => {
            const testSchema: GenericTree<SchemaTag, TreeId> = [{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Room', key: 'room2' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Garden' }, id: 'UUID3', children: [] }]},
                            { data: { tag: 'Exit', from: 'room2', to: 'testRoom', key: 'room2:testRoom' }, id: 'UUID4', children: [{ data: { tag: 'String', value: 'text' }, children: [], id: 'UUID5' }] }
                        ]
                    },
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID5', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: 'UUID6', children: [] }]},
                            { data: { tag: 'Exit', to: 'room2', from: 'testRoom', key: 'testRoom:room2' }, id: 'UUID7', children: [{ data: { tag: 'String', value: 'out' }, children: [], id: 'UUID8' }] }
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
                (state) => {
                    updateStandard(state as any, {
                        type: 'updateStandard',
                        payload: {
                            type: 'renameKey',
                            from: 'room2',
                            to: 'garden'
                        }
                    })
                }
            ).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Room' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Description' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Description' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Exit', to: 'garden', from: 'testRoom', key: 'testRoom:garden' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'out' }, children: [], id: expect.any(String) }] }
                        ]
                    },
                    {
                        data: { tag: 'Room', key: 'garden' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Garden' }, id: expect.any(String), children: [] }]},
                            { data: { tag: 'Exit', from: 'garden', to: 'testRoom', key: 'garden:testRoom' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'text' }, children: [], id: expect.any(String) }] }
                        ]
                    }
                ]
            }])
        })

        it('should rename map references on rename of room', () => {
            const testSchema: GenericTree<SchemaTag, TreeId> = [{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
                id: 'UUID1',
                children: [
                    {
                        data: { tag: 'Room', key: 'room2' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: 'UUID2', children: [{ data: { tag: 'String', value: 'Garden' }, id: 'UUID3', children: [] }]}
                        ]
                    },
                    {
                        data: { tag: 'Map', key: 'testMap' },
                        id: 'DEF',
                        children: [{
                            data: { tag: 'Room', key: 'room2' },
                            id: 'UUID4',
                            children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [], id: 'UUID5' }]
                        }]
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
                (state) => {
                    updateStandard(state as any, {
                        type: 'updateStandard',
                        payload: {
                            type: 'renameKey',
                            from: 'room2',
                            to: 'garden'
                        }
                    })
                }
            ).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset' },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Room', key: 'garden' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Garden' }, id: expect.any(String), children: [] }]},
                        ]
                    },
                    {
                        data: { tag: 'Map', key: 'testMap' },
                        id: expect.any(String),
                        children: [{
                            data: { tag: 'Room', key: 'garden' },
                            id: expect.any(String),
                            children: [{ data: { tag: 'Position', x: 0, y: 0 }, children: [], id: expect.any(String) }]
                        }]
                    }
                ]
            }])
        })

        it('should rename link targets on rename of feature', () => {
            const testSchema: GenericTree<SchemaTag, TreeId> = [{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
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
                                    data: { tag: 'Link', to: 'feature1', text: '' },
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
            const standardize = new Standardizer(testSchema)
            expect(produce(
                {
                    schema: testSchema,
                    standard: standardize.standardForm,
                    inherited: { key: 'testAsset', tag: 'Asset', byId: {}, metaData: [] }
                },
                (state) => {
                    updateStandard(state as any, {
                        type: 'updateStandard',
                        payload: {
                            type: 'renameKey',
                            from: 'feature1',
                            to: 'clockTower'
                        }
                    })
                }
            ).schema).toEqual([{
                data: { tag: 'Asset', key: 'testAsset', Story: undefined },
                id: expect.any(String),
                children: [
                    {
                        data: { tag: 'Feature', key: 'clockTower' },
                        id: expect.any(String),
                        children: [
                            { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Feature' }, id: expect.any(String), children: [] }]},
                            {
                                data: { tag: 'Description' },
                                id: expect.any(String),
                                children: [{
                                    data: { tag: 'Link', to: 'clockTower', text: '' },
                                    id: expect.any(String),
                                    children: [
                                        { data: { tag: 'String', value: 'Link' }, id: expect.any(String), children: [] }
                                    ]
                                }]
                            },
                        ]
                    }
                ]
            }])
        })        
    })
})