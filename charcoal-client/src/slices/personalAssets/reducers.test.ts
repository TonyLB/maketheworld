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
            expect(updateSchema({ schema: testSchema } as any, {
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
            })).toEqual({
                schema: [{
                    data: { tag: 'Asset', key: 'testAsset' },
                    id: '',
                    children: [
                        {
                            data: { tag: 'Room', key: 'testRoom' },
                            id: 'ABC',
                            children: [
                                { data: { tag: 'Name' }, id: expect.any(String), children: [{ data: { tag: 'String', value: 'Test Update' }, id: expect.any(String), children: [] }]},
                                { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]}
                            ]
                        }
                    ]    
                }],
                normalizer: expect.any(Object)
            })
        })

        it('should add children', () => {
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
            expect(updateSchema({ schema: testSchema } as any, {
                type: 'updateSchema',
                payload: {
                    type: 'addChild',
                    id: 'DEF',
                    item: {
                        data: { tag: 'String', value: ': Edited' },
                        children: []
                    }
                }
            })).toEqual({
                schema: [{
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
                                    children: [
                                        { data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] },
                                        { data: { tag: 'String', value: ': Edited' }, id: expect.any(String), children: [] },
                                    ]
                                },
                                { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]}
                            ]
                        }
                    ]    
                }],
                normalizer: expect.any(Object)
            })
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
            expect(updateSchema({ schema: testSchema } as any, {
                type: 'updateSchema',
                payload: {
                    type: 'delete',
                    id: 'DEF'
                }
            })).toEqual({
                schema: [{
                    data: { tag: 'Asset', key: 'testAsset' },
                    id: '',
                    children: [
                        {
                            data: { tag: 'Room', key: 'testRoom' },
                            id: 'ABC',
                            children: [
                                { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]}
                            ]
                        }
                    ]
                }],
                normalizer: expect.any(Object)
            })
        })

        it('should update a schemaTag without changing its children', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: '',
                children: [
                    {
                        data: { tag: 'If', conditions: [{ if: 'true' }] },
                        id: 'IF-1',
                        children: [{
                            data: { tag: 'Room', key: 'testRoom' },
                            id: 'ABC',
                            children: [
                                { data: { tag: 'Name' }, id: 'DEF', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                                { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]}
                            ]
                        }]
                    }
                ]
            }]
            expect(updateSchema({ schema: testSchema } as any, {
                type: 'updateSchema',
                payload: {
                    type: 'updateNode',
                    id: 'IF-1',
                    item: { tag: 'If', conditions: [{ if: 'false' }] }
                }
            })).toEqual({
                schema: [{
                    data: { tag: 'Asset', key: 'testAsset' },
                    id: '',
                    children: [
                        {
                            data: { tag: 'If', conditions: [{ if: 'false' }] },
                            id: 'IF-1',
                            children: [{
                                data: { tag: 'Room', key: 'testRoom' },
                                id: 'ABC',
                                children: [
                                    { data: { tag: 'Name' }, id: 'DEF', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                                    { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]}
                                ]
                            }]
                        }
                    ]
                }],
                normalizer: expect.any(Object)
            })
        })

        it('should rename exit targets on rename of room', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: '',
                children: [
                    {
                        data: { tag: 'Room', key: 'testRoom' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: '', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                            { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]},
                            { data: { tag: 'Exit', to: 'room2', text: 'out' }, id: '', children: [] }
                        ]
                    },
                    {
                        data: { tag: 'Room', key: 'room2' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: '', children: [{ data: { tag: 'String', value: 'Garden' }, id: '', children: [] }]},
                            { data: { tag: 'Exit', to: 'testRoom', text: 'lobby' }, id: '', children: [] }
                        ]
                    }
                ]
            }]
            expect(updateSchema({ schema: testSchema } as any, {
                type: 'updateSchema',
                payload: {
                    type: 'rename',
                    fromKey: 'room2',
                    toKey: 'garden'
                }
            })).toEqual({
                schema: [{
                    data: { tag: 'Asset', key: 'testAsset' },
                    id: '',
                    children: [
                        {
                            data: { tag: 'Room', key: 'testRoom' },
                            id: 'ABC',
                            children: [
                                { data: { tag: 'Name' }, id: '', children: [{ data: { tag: 'String', value: 'Test Room' }, id: 'GHI', children: [] }]},
                                { data: { tag: 'Description' }, id: 'JKL', children: [{ data: { tag: 'String', value: 'Test Description' }, id: '', children: [] }]},
                                { data: { tag: 'Exit', to: 'garden', text: 'out' }, id: '', children: [] }
                            ]
                        },
                        {
                            data: { tag: 'Room', key: 'garden' },
                            id: 'ABC',
                            children: [
                                { data: { tag: 'Name' }, id: '', children: [{ data: { tag: 'String', value: 'Garden' }, id: '', children: [] }]},
                                { data: { tag: 'Exit', to: 'testRoom', text: 'lobby' }, id: '', children: [] }
                            ]
                        }
                    ]    
                }],
                normalizer: expect.any(Object)
            })
        })

        it('should rename link targets on rename of feature', () => {
            const testSchema = [{
                data: { tag: 'Asset', key: 'testAsset' },
                id: '',
                children: [
                    {
                        data: { tag: 'Feature', key: 'feature1' },
                        id: 'ABC',
                        children: [
                            { data: { tag: 'Name' }, id: '', children: [{ data: { tag: 'String', value: 'Test Feature' }, id: 'GHI', children: [] }]},
                            {
                                data: { tag: 'Description' },
                                id: 'JKL',
                                children: [{
                                    data: { tag: 'Link', to: 'feature1' },
                                    id: '',
                                    children: [
                                        { data: { tag: 'String', value: 'Link' }, id: '', children: [] }
                                    ]
                                }]
                            },
                        ]
                    }
                ]
            }]
            expect(updateSchema({ schema: testSchema } as any, {
                type: 'updateSchema',
                payload: {
                    type: 'rename',
                    fromKey: 'feature1',
                    toKey: 'clockTower'
                }
            })).toEqual({
                schema: [{
                    data: { tag: 'Asset', key: 'testAsset' },
                    id: '',
                    children: [
                        {
                            data: { tag: 'Feature', key: 'clockTower' },
                            id: 'ABC',
                            children: [
                                { data: { tag: 'Name' }, id: '', children: [{ data: { tag: 'String', value: 'Test Feature' }, id: 'GHI', children: [] }]},
                                {
                                    data: { tag: 'Description' },
                                    id: 'JKL',
                                    children: [{
                                        data: { tag: 'Link', to: 'clockTower' },
                                        id: '',
                                        children: [
                                            { data: { tag: 'String', value: 'Link' }, id: '', children: [] }
                                        ]
                                    }]
                                },
                            ]
                        }
                    ]
                }],
                normalizer: expect.any(Object)
            })
        })        
    })
})