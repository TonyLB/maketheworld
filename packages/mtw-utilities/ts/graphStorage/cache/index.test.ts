import { CacheBase, GraphDBHandler } from './baseClasses'
import GraphCache from './'
import GraphEdge from './graphEdge'
import GraphNode, { GraphNodeCache, GraphNodeCacheEdge } from './graphNode'
import { marshall } from '@aws-sdk/util-dynamodb'

describe('GraphCache', () => {
    const realDateNow = Date.now.bind(global.Date);

    const dbHandler = {
        getItem: jest.fn(),
        getItems: jest.fn(),
        primitiveUpdate: jest.fn()
    } as unknown as GraphDBHandler
    const internalCache = new ((GraphCache(dbHandler))(GraphEdge(dbHandler)(GraphNode(dbHandler)(CacheBase))))()
    jest.spyOn(internalCache.Edges, 'get')

    const cacheFactory = (entries: string[]): GraphNodeCacheEdge<string>[] => (
        entries.map((key) => ({ from: key.split('::')[0], to: key.split('::')[1], context: '' }))
    )

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
        const dateNowStub = jest.fn(() => 1000)
        global.Date.now = dateNowStub
    })

    afterEach(() => {
        global.Date.now = realDateNow
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

        jest.spyOn(dbHandler, 'primitiveUpdate').mockResolvedValue({})
        const tree = await internalCache.Graph.get(['A'], 'forward')
        await internalCache.flush()
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

        //
        // Should update all caches
        //
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledTimes(6)
        const testArgument = (key: string, cache: string[]) => ({
            Key: { PrimaryKey: key, DataCategory: 'Graph::Forward' },
            UpdateExpression: 'SET cache = :newCache, cachedAt = :moment',
            ConditionExpression: 'attribute_not_exists(cachedAt) OR cachedAt < :moment',
            ExpressionAttributeValues: marshall({
                ':newCache': cache,
                ':moment': 1000
            })
        })
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledWith(testArgument('A', ['A::B', 'A::C', 'B::C', 'C::D', 'C::E', 'D::F', 'E::F']))
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledWith(testArgument('B', ['B::C', 'C::D', 'C::E', 'D::F', 'E::F']))
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledWith(testArgument('C', ['C::D', 'C::E', 'D::F', 'E::F']))
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledWith(testArgument('D', ['D::F']))
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledWith(testArgument('E', ['E::F']))
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledWith(testArgument('F', []))

    })

    it('should correctly fetch a tree with valid caches', async () => {
        const nodeGetMock = jest.spyOn(internalCache.Nodes, 'get')
            .mockImplementation((keys) => (
                Promise.resolve(
                    keys.map((key): GraphNodeCache<string> | undefined => ({
                        A: {
                            PrimaryKey: 'A',
                            forward: {
                                edges: [{ target: 'B', context: '' }, { target: 'C', context: '' }],
                                cache: cacheFactory(['A::B', 'A::C', 'B::C', 'C::D', 'C::E', 'D::F', 'E::F'])
                            },
                            back: {
                                edges: []
                            }
                        },
                        B: {
                            PrimaryKey: 'B',
                            forward: {
                                edges: [{ target: 'C', context: '' }],
                                cache: cacheFactory(['B::C', 'C::D', 'C::E', 'D::F', 'E::F'])
                            },
                            back: {
                                edges: [{ target: 'A', context: '' }]
                            }
                        },
                        C: {
                            PrimaryKey: 'C',
                            forward: {
                                edges: [{ target: 'D', context: '' }, { target: 'E', context: '' }],
                                cache: cacheFactory(['C::D', 'C::E', 'D::F', 'E::F'])
                            },
                            back: {
                                edges: [{ target: 'A', context: '' }, { target: 'B', context: '' }]
                            }
                        },
                        D: {
                            PrimaryKey: 'D',
                            forward: {
                                edges: [{ target: 'F', context: '' }],
                                cache: cacheFactory(['D::F'])
                            },
                            back: {
                                edges: [{ target: 'C', context: '' }]
                            }
                        },
                        E: {
                            PrimaryKey: 'E',
                            forward: {
                                edges: [{ target: 'F', context: '' }],
                                cache: cacheFactory(['E::F'])
                            },
                            back: {
                                edges: [{ target: 'C', context: '' }]
                            }
                        },
                        F: {
                            PrimaryKey: 'F',
                            forward: {
                                edges: [],
                                cache: []
                            },
                            back: {
                                edges: [{ target: 'D', context: '' }, { target: 'E', context: '' }]
                            }
                        },
                    }[key])
                ).filter((value): value is GraphNodeCache<string> => (Boolean(value)))
            )
        ))

        jest.spyOn(dbHandler, 'primitiveUpdate').mockResolvedValue({})
        const tree = await internalCache.Graph.get(['A'], 'forward')
        await internalCache.flush()
        expect(nodeGetMock).toHaveBeenCalledTimes(2)
        expect(nodeGetMock).toHaveBeenCalledWith(['A'])
        expect(nodeGetMock).toHaveBeenCalledWith(['B', 'C', 'D', 'E', 'F'])
        expect(Object.keys(tree.nodes)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
        expect(tree.edges).toEqual([
            { from: 'A', to: 'B', context: '' },
            { from: 'A', to: 'C', context: '' },
            { from: 'B', to: 'C', context: '' },
            { from: 'C', to: 'D', context: '' },
            { from: 'C', to: 'E', context: '' },
            { from: 'D', to: 'F', context: '' },
            { from: 'E', to: 'F', context: '' }
        ])

        //
        // Does not need to update any caches
        //
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledTimes(0)

    })

    it('should correct a tree with inconsistent caches', async () => {
        const nodeGetMock = jest.spyOn(internalCache.Nodes, 'get')
            .mockImplementation((keys) => (
                Promise.resolve(
                    keys.map((key): GraphNodeCache<string> | undefined => ({
                        A: {
                            PrimaryKey: 'A',
                            forward: {
                                edges: [{ target: 'B', context: '' }, { target: 'C', context: '' }],
                                cache: cacheFactory(['A::B', 'A::C', 'B::C', 'C::D', 'D::F'])
                            },
                            back: {
                                edges: []
                            }
                        },
                        B: {
                            PrimaryKey: 'B',
                            forward: {
                                edges: [{ target: 'C', context: '' }],
                                cache: cacheFactory(['B::C', 'C::D', 'C::E', 'D::F', 'E::F'])
                            },
                            back: {
                                edges: [{ target: 'A', context: '' }]
                            }
                        },
                        C: {
                            PrimaryKey: 'C',
                            forward: {
                                edges: [{ target: 'D', context: '' }, { target: 'E', context: '' }],
                                cache: cacheFactory(['C::D', 'C::E', 'D::F', 'E::F'])
                            },
                            back: {
                                edges: [{ target: 'A', context: '' }, { target: 'B', context: '' }]
                            }
                        },
                        D: {
                            PrimaryKey: 'D',
                            forward: {
                                edges: [{ target: 'F', context: '' }],
                                cache: cacheFactory(['D::F'])
                            },
                            back: {
                                edges: [{ target: 'C', context: '' }]
                            }
                        },
                        E: {
                            PrimaryKey: 'E',
                            forward: {
                                edges: [{ target: 'F', context: '' }],
                                cache: cacheFactory(['E::F'])
                            },
                            back: {
                                edges: [{ target: 'C', context: '' }]
                            }
                        },
                        F: {
                            PrimaryKey: 'F',
                            forward: {
                                edges: [],
                                cache: []
                            },
                            back: {
                                edges: [{ target: 'D', context: '' }, { target: 'E', context: '' }]
                            }
                        },
                    }[key])
                ).filter((value): value is GraphNodeCache<string> => (Boolean(value)))
            )
        ))

        jest.spyOn(dbHandler, 'primitiveUpdate').mockResolvedValue({})
        const tree = await internalCache.Graph.get(['A'], 'forward')
        await internalCache.flush()
        expect(nodeGetMock).toHaveBeenCalledTimes(3)
        expect(nodeGetMock).toHaveBeenCalledWith(['A'])
        expect(nodeGetMock).toHaveBeenCalledWith(['B', 'C', 'D', 'F'])
        expect(nodeGetMock).toHaveBeenCalledWith(['E'])
        expect(Object.keys(tree.nodes)).toEqual(['A', 'B', 'C', 'D', 'F', 'E'])
        expect(tree.edges).toEqual([
            { from: 'A', to: 'B', context: '' },
            { from: 'A', to: 'C', context: '' },
            { from: 'B', to: 'C', context: '' },
            { from: 'C', to: 'D', context: '' },
            { from: 'C', to: 'E', context: '' },
            { from: 'D', to: 'F', context: '' },
            { from: 'E', to: 'F', context: '' }
        ])

        //
        // Updates only the inconsistent cache
        //
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledTimes(1)
        const testArgument = (key: string, cache: string[]) => ({
            Key: { PrimaryKey: key, DataCategory: 'Graph::Forward' },
            UpdateExpression: 'SET cache = :newCache, cachedAt = :moment',
            ConditionExpression: 'attribute_not_exists(cachedAt) OR cachedAt < :moment',
            ExpressionAttributeValues: marshall({
                ':newCache': cache,
                ':moment': 1000
            })
        })
        expect(dbHandler.primitiveUpdate).toHaveBeenCalledWith(testArgument('A', ['A::B', 'A::C', 'B::C', 'C::D', 'C::E', 'D::F', 'E::F']))

    })

})