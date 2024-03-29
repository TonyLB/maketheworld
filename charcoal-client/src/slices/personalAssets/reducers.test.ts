import produce from "immer"
import { updateSchema } from "./reducers"

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
            expect(produce({ schema: testSchema }, (state) => updateSchema(state as any, {
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
            })).schema).toEqual([{
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
            expect(produce({ schema: testSchema }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'addChild',
                    id: 'DEF',
                    item: {
                        data: { tag: 'String', value: ': Edited' },
                        children: []
                    }
                }
            })).schema).toEqual([{
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
            expect(produce({ schema: testSchema }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'delete',
                    id: 'DEF'
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
                                        data: { tag: 'Statement', if: 'true' },
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
            expect(produce({ schema: testSchema }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'updateNode',
                    id: 'ABC',
                    item: { tag: 'Room', key: 'lobby' }
                }
            })).schema).toEqual([{
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
                                        data: { tag: 'Statement', if: 'true' },
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
            expect(produce({ schema: testSchema }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'rename',
                    fromKey: 'room2',
                    toKey: 'garden'
                }
            })).schema).toEqual([{
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
            const testOutput = produce({ schema: testSchema, baseSchema: [] }, (state) => updateSchema(state as any, {
                type: 'updateSchema',
                payload: {
                    type: 'rename',
                    fromKey: 'feature1',
                    toKey: 'clockTower'
                }
            }))
            expect(testOutput.schema).toEqual([{
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
})