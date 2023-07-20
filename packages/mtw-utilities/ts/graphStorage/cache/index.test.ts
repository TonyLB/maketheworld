jest.mock('../../dynamoDB/index')
import { ephemeraDB } from '../../dynamoDB/index'

import { DependencyNode, CacheBase, GraphDBHandler } from './baseClasses'
import { LegacyGraphCache, DependencyTreeWalker, GraphCache } from './'
import GraphEdge from './graphEdge'
import GraphNode, { GraphNodeCache } from './graphNode'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('DependencyTreeWalker', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('should walk an acyclic tree', () => {
        const walker = new DependencyTreeWalker([
            {
                EphemeraId: 'VARIABLE#testOne',
                connections: [
                    { EphemeraId: 'COMPUTED#testTwo', key: 'testOne', assets: ['base'] },
                    { EphemeraId: 'COMPUTED#testThree', key: 'testOne', assets: ['base'] }
                ]
            },
            {
                EphemeraId: 'COMPUTED#testTwo',
                connections: [{ EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] }]
            },
            {
                EphemeraId: 'COMPUTED#testThree',
                connections: []
            }
        ])

        const testCallback = jest.fn()
        walker.walk({ start: 'VARIABLE#testOne', callback: testCallback })
        expect(testCallback).toHaveBeenCalledTimes(4)
        expect(testCallback).toHaveBeenCalledWith({
            node: {
                EphemeraId: 'VARIABLE#testOne',
                connections: [
                    { EphemeraId: 'COMPUTED#testTwo', key: 'testOne', assets: ['base'] },
                    { EphemeraId: 'COMPUTED#testThree', key: 'testOne',  assets: ['base'] }
                ]
            },
            revisit: false
        })
        expect(testCallback).toHaveBeenCalledWith({
            key: 'testOne',
            assets: ['base'],
            revisit: false,
            node: {
                EphemeraId: 'COMPUTED#testTwo',
                connections: [{ EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] }],
            }
        })
        expect(testCallback).toHaveBeenCalledWith({
            key: 'testTwo',
            assets: ['base'],
            revisit: false,
            node: {
                EphemeraId: 'COMPUTED#testThree',
                connections: [],
            }
        })
        expect(testCallback).toHaveBeenCalledWith({
            key: 'testOne',
            assets: ['base'],
            revisit: true,
            node: {
                EphemeraId: 'COMPUTED#testThree',
                connections: [],
            }
        })
    })

    it('should walk a cyclic tree', () => {
        const walker = new DependencyTreeWalker([
            {
                EphemeraId: 'FEATURE#testOne',
                connections: [{ EphemeraId: 'FEATURE#testTwo', key: 'testOne', assets: ['base'] }]
            },
            {
                EphemeraId: 'FEATURE#testTwo',
                connections: [{ EphemeraId: 'FEATURE#testThree', key: 'testTwo', assets: ['base'] }]
            },
            {
                EphemeraId: 'FEATURE#testThree',
                connections: [{ EphemeraId: 'FEATURE#testOne', key: 'testThree', assets: ['base'] }]
            }
        ])

        const testCallback = jest.fn()
        walker.walk({ start: 'FEATURE#testOne', callback: testCallback })
        expect(testCallback).toHaveBeenCalledTimes(4)
        expect(testCallback).toHaveBeenCalledWith({
            node: {
                EphemeraId: 'FEATURE#testOne',
                connections: [{ EphemeraId: 'FEATURE#testTwo', key: 'testOne', assets: ['base'] }]
            },
            revisit: false
        })
        expect(testCallback).toHaveBeenCalledWith({
            key: 'testOne',
            assets: ['base'],
            revisit: false,
            node: {
                EphemeraId: 'FEATURE#testTwo',
                connections: [{ EphemeraId: 'FEATURE#testThree', key: 'testTwo', assets: ['base'] }],
            }
        })
        expect(testCallback).toHaveBeenCalledWith({
            key: 'testTwo',
            assets: ['base'],
            revisit: false,
            node: {
                EphemeraId: 'FEATURE#testThree',
                connections: [{ EphemeraId: 'FEATURE#testOne', key: 'testThree', assets: ['base'] }],
            }
        })
        expect(testCallback).toHaveBeenCalledWith({
            key: 'testThree',
            assets: ['base'],
            revisit: true,
            node: {
                EphemeraId: 'FEATURE#testOne',
                connections: [{ EphemeraId: 'FEATURE#testTwo', key: 'testOne', assets: ['base'] }]
            }
        })
    })
})

describe('LegacyGraphCache', () => {
    const internalCache = new (LegacyGraphCache(CacheBase))()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    const testStore: Record<string, DependencyNode> = {
        'VARIABLE#testOne': {
            EphemeraId: 'VARIABLE#testOne',
            completeness: 'Complete',
            connections: [
                { EphemeraId: 'COMPUTED#testTwo', assets: ['base'] },
                { EphemeraId: 'COMPUTED#testThree', assets: ['base'] }
            ]
        },
        'COMPUTED#testTwo': {
            EphemeraId: 'COMPUTED#testTwo',
            completeness: 'Partial',
            connections: [{ EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] }]
        },
        'COMPUTED#testThree': {
            EphemeraId: 'COMPUTED#testThree',
            completeness: 'Partial',
            connections: []
        }
    }

    describe('get', () => {
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            internalCache.clear()
        })

        afterEach(async () => {
            await internalCache.flush()
        })

        it('should correctly fetch a tree', async () => {
            internalCache.Descent._Store = { ...testStore }
            ephemeraMock.getItem.mockResolvedValue({
                Descent: [
                    {
                        EphemeraId: 'COMPUTED#testTwo',
                        tag: 'Computed',
                        connections: [{
                            EphemeraId: 'COMPUTED#testThree',
                            key: 'testTwo',
                            assets: ['base'],
                        }]
                    },
                    {
                        EphemeraId: 'COMPUTED#testThree',
                        tag: 'Computed',
                        connections: []
                    }
                ]
            })
            const output = await internalCache.Descent.get('COMPUTED#testTwo')
            expect(output).toMatchSnapshot()
        })
    })

    describe('getPartial', () => {
        it('should correctly decipher a partial tree', () => {
            internalCache.Descent._Store = { ...testStore }
    
            expect(internalCache.Descent.getPartial('VARIABLE#testOne')).toMatchSnapshot()
        })
    })

    describe('isComplete', () => {
        it('should correctly tag a partial tree', () => {
            internalCache.Descent._Store = { ...testStore }
    
            expect(internalCache.Descent.isComplete('VARIABLE#testOne')).toBe(false)
        })

        it('should correctly flag a complete tree', () => {
            internalCache.Descent._Store = {
                'VARIABLE#testOne': {
                    EphemeraId: 'VARIABLE#testOne',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#testTwo', key: 'testOne', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#testThree', key: 'testOne', assets: ['base'] }
                    ]
                },
                'COMPUTED#testTwo': {
                    EphemeraId: 'COMPUTED#testTwo',
                    completeness: 'Complete',
                    connections: [{ EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] }]
                },
                'COMPUTED#testThree': {
                    EphemeraId: 'COMPUTED#testThree',
                    completeness: 'Complete',
                    connections: []
                }
            }
    
            expect(internalCache.Descent.isComplete('VARIABLE#testOne')).toBe(true)
        })
    })

    describe('put', () => {
        it('should correctly add a single graph item', () => {
            internalCache.Descent._Store = testStore
            internalCache.Descent.put([{
                EphemeraId: 'COMPUTED#testFour',
                completeness: 'Partial',
                connections: [{ EphemeraId: 'COMPUTED#testTwo', key: 'testFour', assets: ['base'] }]
            }])
            expect(internalCache.Descent.getPartial('COMPUTED#testFour')).toMatchSnapshot()
        })

        it('should correctly add a complete tree', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.put([
                {
                    EphemeraId: 'COMPUTED#testFour',
                    completeness: 'Complete',
                    connections: [
                        {
                            EphemeraId: 'COMPUTED#testTwo',
                            key: 'testFour',
                            assets: ['base'],
                        }
                    ]
                },
                {
                    EphemeraId: 'COMPUTED#testTwo',
                    completeness: 'Partial',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#testThree',
                    completeness: 'Partial',
                    connections: []
                }
            ])
            expect(internalCache.Descent.getPartial('COMPUTED#testFour')).toMatchSnapshot()
        })

        it('should backpopulate antidependency links', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.put([{
                EphemeraId: 'COMPUTED#testFour',
                completeness: 'Partial',
                connections: [
                    {
                        EphemeraId: 'COMPUTED#testTwo',
                        key: 'testFour',
                        assets: ['base'],
                    }
                ]
            }])
            expect(internalCache.Ancestry.getPartial('COMPUTED#testTwo')).toMatchSnapshot()
        })
    })

    describe('delete', () => {
        it('should correctly delete a connection', () => {
            internalCache.Descent._Store = { ...testStore }
            internalCache.Descent.delete('COMPUTED#testTwo', { EphemeraId: 'COMPUTED#testThree', key: 'testTwo', assets: ['base'] })
            expect(internalCache.Descent.getPartial('VARIABLE#testOne')).toMatchSnapshot()
        })

        it('should decrement connection assets when redundancies exist', () => {
            internalCache.Descent._Store = {
                'VARIABLE#testOne': {
                    EphemeraId: 'VARIABLE#testOne',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#testTwo', assets: ['base', 'layer'] }
                    ]
                },
                'COMPUTED#testTwo': {
                    EphemeraId: 'COMPUTED#testTwo',
                    completeness: 'Partial',
                    connections: []
                }
            }
            internalCache.Descent.delete('VARIABLE#testOne', { EphemeraId: 'COMPUTED#testTwo', assets: ['layer'] })
            expect(internalCache.Descent.getPartial('VARIABLE#testOne')).toMatchSnapshot()
        })
    })

    describe('generationOrder', () => {
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            internalCache.clear()
        })

        it('should correctly calculate generation order for a complex graph', () => {
            internalCache.Descent._Store = {
                'VARIABLE#One': {
                    EphemeraId: 'VARIABLE#One',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Two', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Three', assets: ['base'] }
                    ]
                },
                'COMPUTED#Two': {
                    EphemeraId: 'COMPUTED#Two',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Four', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] }
                    ]
                },
                'COMPUTED#Three': {
                    EphemeraId: 'COMPUTED#Three',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Six', assets: ['base'] }
                    ]
                },
                'COMPUTED#Four': {
                    EphemeraId: 'COMPUTED#Four',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                'COMPUTED#Five': {
                    EphemeraId: 'COMPUTED#Five',
                    completeness: 'Partial',
                    connections: []
                },
                'COMPUTED#Six': {
                    EphemeraId: 'COMPUTED#Six',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                'COMPUTED#Seven': {
                    EphemeraId: 'COMPUTED#Seven',
                    completeness: 'Partial',
                    connections: []
                }
            }
            expect(internalCache.Descent.generationOrder(['COMPUTED#Seven', 'COMPUTED#Four', 'COMPUTED#Two', 'VARIABLE#One', 'COMPUTED#Six'])).toMatchSnapshot()
        })
    })

    describe('getBatch', () => {
        beforeEach(() => {
            jest.clearAllMocks()
            jest.resetAllMocks()
            internalCache.clear()
        })
    
        it('should correctly create a minimal covering-set of dependency fetches', async () => {
            internalCache.Descent._Store = {
                'VARIABLE#One': {
                    EphemeraId: 'VARIABLE#One',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Two', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Three', assets: ['base'] }
                    ]
                },
                'COMPUTED#Two': {
                    EphemeraId: 'COMPUTED#Two',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Four', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] }
                    ]
                },
                'COMPUTED#Three': {
                    EphemeraId: 'COMPUTED#Three',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Six', assets: ['base'] }
                    ]
                },
                'COMPUTED#Four': {
                    EphemeraId: 'COMPUTED#Four',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                'COMPUTED#Five': {
                    EphemeraId: 'COMPUTED#Five',
                    completeness: 'Partial',
                    connections: []
                },
                'COMPUTED#Six': {
                    EphemeraId: 'COMPUTED#Six',
                    completeness: 'Partial',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                'COMPUTED#Seven': {
                    EphemeraId: 'COMPUTED#Seven',
                    completeness: 'Partial',
                    connections: []
                }
            }
            ephemeraMock.getItems.mockResolvedValue([
                {
                    Descent: [
                        {
                            EphemeraId: 'COMPUTED#Two',
                            connections: [
                                { EphemeraId: 'COMPUTED#Four', assets: ['base'] },
                                { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                                { EphemeraId: 'COMPUTED#Eight', assets: ['layer'] }
                            ]
                        },
                        {
                            EphemeraId: 'COMPUTED#Four',
                            connections: [
                                { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                            ]
                        },
                        {
                            EphemeraId: 'COMPUTED#Five',
                            connections: []
                        },
                        {
                            EphemeraId: 'COMPUTED#Seven',
                            connections: []
                        },
                        {
                            EphemeraId: 'COMPUTED#Eight',
                            connections: []
                        }
                    ]
                },
                {
                    Descent: [
                        {
                            EphemeraId: 'COMPUTED#Three',
                            connections: [
                                { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                                { EphemeraId: 'COMPUTED#Six', assets: ['base'] }
                            ]
                        },
                        {
                            EphemeraId: 'COMPUTED#Five',
                            connections: []
                        },
                        {
                            EphemeraId: 'COMPUTED#Six',
                            connections: [
                                { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                            ]
                        },
                        {
                            EphemeraId: 'COMPUTED#Seven',
                            connections: []
                        }
                    ]
                }
            ])

            const output = await internalCache.Descent.getBatch(['COMPUTED#Two', 'COMPUTED#Three', 'COMPUTED#Five', 'COMPUTED#Seven'])
            expect(output).toEqual([
                {
                    EphemeraId: 'COMPUTED#Two',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#Four', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Eight', assets: ['layer'] }
                    ]
                },
                {
                    EphemeraId: 'COMPUTED#Four',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                },
                {
                    EphemeraId: 'COMPUTED#Seven',
                    completeness: 'Complete',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#Five',
                    completeness: 'Complete',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#Eight',
                    completeness: 'Complete',
                    connections: []
                },
                {
                    EphemeraId: 'COMPUTED#Three',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#Five', assets: ['base'] },
                        { EphemeraId: 'COMPUTED#Six', assets: ['base'] }
                    ]
                },
                {
                    EphemeraId: 'COMPUTED#Six',
                    completeness: 'Complete',
                    connections: [
                        { EphemeraId: 'COMPUTED#Seven', assets: ['base'] }
                    ]
                }
            ])
            expect(ephemeraDB.getItems).toHaveBeenCalledTimes(1)
            expect(ephemeraDB.getItems).toHaveBeenCalledWith({
                Keys: [
                    { EphemeraId: 'COMPUTED#Two', DataCategory: 'Meta::Computed' },
                    { EphemeraId: 'COMPUTED#Three', DataCategory: 'Meta::Computed' }
                ],
                ProjectionFields: ['Descent']
            })

        })
    })
})

describe('GraphCache', () => {
    const dbHandler = {
        getItem: jest.fn(),
        getItems: jest.fn()
    } as unknown as GraphDBHandler
    const internalCache = new (GraphCache(GraphEdge(dbHandler)(GraphNode(dbHandler)(CacheBase))))()
    jest.spyOn(internalCache.Edges, 'get')

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should correctly fetch a tree recursively', async () => {
        const nodeGetMock = jest.spyOn(internalCache.Nodes, 'get')
            .mockImplementation((keys) => (
                Promise.resolve(
                    keys.map((key): GraphNodeCache<string> | undefined => ({
                        A: {
                            PrimaryKey: 'A',
                            forward: {
                                edges: [{ target: 'B', context: '' }, { target: 'C', context: '' }],
                            },
                            back: {
                                edges: []
                            }
                        },
                        B: {
                            PrimaryKey: 'B',
                            forward: {
                                edges: [{ target: 'C', context: '' }],
                            },
                            back: {
                                edges: [{ target: 'A', context: '' }]
                            }
                        },
                        C: {
                            PrimaryKey: 'C',
                            forward: {
                                edges: [{ target: 'D', context: '' }, { target: 'E', context: '' }],
                            },
                            back: {
                                edges: [{ target: 'A', context: '' }, { target: 'B', context: '' }]
                            }
                        },
                        D: {
                            PrimaryKey: 'D',
                            forward: {
                                edges: [{ target: 'F', context: '' }],
                            },
                            back: {
                                edges: [{ target: 'C', context: '' }]
                            }
                        },
                        E: {
                            PrimaryKey: 'E',
                            forward: {
                                edges: [{ target: 'F', context: '' }],
                            },
                            back: {
                                edges: [{ target: 'C', context: '' }]
                            }
                        },
                        F: {
                            PrimaryKey: 'F',
                            forward: {
                                edges: [],
                            },
                            back: {
                                edges: [{ target: 'D', context: '' }, { target: 'E', context: '' }]
                            }
                        },
                    }[key])
                ).filter((value): value is GraphNodeCache<string> => (Boolean(value)))
            )
        ))

        const tree = await internalCache.Graph.get(['A'], 'forward')
        expect(nodeGetMock).toHaveBeenCalledTimes(4)
        expect(nodeGetMock).toHaveBeenCalledWith(['A'])
        expect(nodeGetMock).toHaveBeenCalledWith(['B', 'C'])
        expect(nodeGetMock).toHaveBeenCalledWith(['D', 'E'])
        expect(nodeGetMock).toHaveBeenCalledWith(['F'])
        expect(tree.nodes).toEqual({
            A: { key: 'A' },
            B: { key: 'B' },
            C: { key: 'C' },
            D: { key: 'D' },
            E: { key: 'E' },
            F: { key: 'F' }
        })
        expect(tree.edges).toEqual([
            { from: 'A', to: 'B', context: '' },
            { from: 'A', to: 'C', context: '' },
            { from: 'B', to: 'C', context: '' },
            { from: 'C', to: 'D', context: '' },
            { from: 'C', to: 'E', context: '' },
            { from: 'D', to: 'F', context: '' },
            { from: 'E', to: 'F', context: '' }
        ])
    })

})