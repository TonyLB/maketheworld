import { CacheBase } from "./baseClasses"
import GraphNode, { GraphDBHandler } from './graphNode'

describe('GraphNode cache', () => {
    const dbHandler: jest.Mocked<GraphDBHandler> = {
        getItems: jest.fn()
    } as unknown as jest.Mocked<GraphDBHandler>
    const internalCache = new (GraphNode(dbHandler)(CacheBase))()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should batch-get everything in an empty cache', async () => {
        dbHandler.getItems.mockResolvedValue([
            { PrimaryKey: 'A', DataCategory: 'GRAPH::Forward', edgeSet: ['B::', 'C::'], cache: ['A::B::', 'A::C::', 'B::C::', 'C::D::'], cachedAt: 900 },
            { PrimaryKey: 'A', DataCategory: 'GRAPH::Back', edgeSet: [], cache: [], cachedAt: 1000 },
            { PrimaryKey: 'B', DataCategory: 'GRAPH::Back', edgeSet: ['A::'], cache: ['A::B::'], cachedAt: 900 },
            { PrimaryKey: 'B', DataCategory: 'GRAPH::Forward', edgeSet: ['C::'], cache: ['B::C::', 'C::D::'], cachedAt: 1000 },
            { PrimaryKey: 'C', DataCategory: 'GRAPH::Forward', edgeSet: ['D::'] },
            { PrimaryKey: 'C', DataCategory: 'GRAPH::Back', edgeSet: ['A::', 'B::'], cache: ['A::C::', 'A::B::', 'B::C::'], cachedAt: 1000 },
            { PrimaryKey: 'D', DataCategory: 'GRAPH::Forward', edgeSet: [], cache: [], cachedAt: 1000 },
            { PrimaryKey: 'D', DataCategory: 'GRAPH::Back', edgeSet: ['C::'] }
        ])
        const results = await internalCache.Nodes.get(['A', 'B', 'C', 'D'])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'A', DataCategory: 'GRAPH::Forward' },
                { PrimaryKey: 'A', DataCategory: 'GRAPH::Back' },
                { PrimaryKey: 'B', DataCategory: 'GRAPH::Forward' },
                { PrimaryKey: 'B', DataCategory: 'GRAPH::Back' },
                { PrimaryKey: 'C', DataCategory: 'GRAPH::Forward' },
                { PrimaryKey: 'C', DataCategory: 'GRAPH::Back' },
                { PrimaryKey: 'D', DataCategory: 'GRAPH::Forward' },
                { PrimaryKey: 'D', DataCategory: 'GRAPH::Back' },
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory', 'invalidatedAt', 'cachedAt', 'edgeSet', 'cache']
        })
        expect(results).toEqual([
            {
                PrimaryKey: 'A',
                forward: {
                    edges: [
                        { target: 'B', context: '' },
                        { target: 'C', context: '' }
                    ],
                    cache: [
                        { source: 'A', target: 'B', context: '' },
                        { source: 'A', target: 'C', context: '' },
                        { source: 'B', target: 'C', context: '' },
                        { source: 'C', target: 'D', context: '' }
                    ],
                    cachedAt: 900
                },
                back: { edges: [], cache: [], cachedAt: 1000 }
            },
            {
                PrimaryKey: 'B',
                forward: {
                    edges: [{ target: 'C', context: '' }],
                    cache: [
                        { source: 'B', target: 'C', context: '' },
                        { source: 'C', target: 'D', context: '' }
                    ],
                    cachedAt: 1000
                },
                back: {
                    edges: [{ target: 'A', context: '' }],
                    cache: [{ source: 'A', target: 'B', context: '' }],
                    cachedAt: 900
                }
            },
            {
                PrimaryKey: 'C',
                forward: {
                    edges: [{ target: 'D', context: '' }],
                },
                back: {
                    edges: [
                        { target: 'A', context: '' },
                        { target: 'B', context: '' }
                    ],
                    cache: [
                        { source: 'A', target: 'C', context: '' },
                        { source: 'A', target: 'B', context: '' },
                        { source: 'B', target: 'C', context: '' }
                    ],
                    cachedAt: 1000
                }
            },
            {
                PrimaryKey: 'D',
                forward: { edges: [], cache: [], cachedAt: 1000 },
                back: { edges: [{ target: 'C', context: '' }] }
            }
        ])
    })

    it('should batch-get only as needed when cache has content', async () => {
        dbHandler.getItems.mockResolvedValueOnce([
            { PrimaryKey: 'A', DataCategory: 'GRAPH::Forward', edgeSet: ['B::', 'C::'], cache: ['A::B::', 'A::C::', 'B::C::', 'C::D::'], cachedAt: 900 },
            { PrimaryKey: 'A', DataCategory: 'GRAPH::Back', edgeSet: [], cache: [], cachedAt: 1000 },
            { PrimaryKey: 'B', DataCategory: 'GRAPH::Back', edgeSet: ['A::'], cache: ['A::B::'], cachedAt: 900 },
            { PrimaryKey: 'B', DataCategory: 'GRAPH::Forward', edgeSet: ['C::'], cache: ['B::C::', 'C::D::'], cachedAt: 1000 }
        ]).mockResolvedValueOnce([
            { PrimaryKey: 'C', DataCategory: 'GRAPH::Forward', edgeSet: ['D::'] },
            { PrimaryKey: 'C', DataCategory: 'GRAPH::Back', edgeSet: ['A::', 'B::'], cache: ['A::C::', 'A::B::', 'B::C::'], cachedAt: 1000 },
            { PrimaryKey: 'D', DataCategory: 'GRAPH::Forward', edgeSet: [], cache: [], cachedAt: 1000 },
            { PrimaryKey: 'D', DataCategory: 'GRAPH::Back', edgeSet: ['C::'] }
        ])
        const results = await internalCache.Nodes.get(['A', 'B'])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'A', DataCategory: 'GRAPH::Forward' },
                { PrimaryKey: 'A', DataCategory: 'GRAPH::Back' },
                { PrimaryKey: 'B', DataCategory: 'GRAPH::Forward' },
                { PrimaryKey: 'B', DataCategory: 'GRAPH::Back' }
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory', 'invalidatedAt', 'cachedAt', 'edgeSet', 'cache']
        })
        expect(results).toEqual([
            {
                PrimaryKey: 'A',
                forward: {
                    edges: [
                        { target: 'B', context: '' },
                        { target: 'C', context: '' }
                    ],
                    cache: [
                        { source: 'A', target: 'B', context: '' },
                        { source: 'A', target: 'C', context: '' },
                        { source: 'B', target: 'C', context: '' },
                        { source: 'C', target: 'D', context: '' }
                    ],
                    cachedAt: 900
                },
                back: { edges: [], cache: [], cachedAt: 1000 }
            },
            {
                PrimaryKey: 'B',
                forward: {
                    edges: [{ target: 'C', context: '' }],
                    cache: [
                        { source: 'B', target: 'C', context: '' },
                        { source: 'C', target: 'D', context: '' }
                    ],
                    cachedAt: 1000
                },
                back: {
                    edges: [{ target: 'A', context: '' }],
                    cache: [{ source: 'A', target: 'B', context: '' }],
                    cachedAt: 900
                }
            }
        ])
        const secondResult = await internalCache.Nodes.get(['A', 'B', 'C', 'D'])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'C', DataCategory: 'GRAPH::Forward' },
                { PrimaryKey: 'C', DataCategory: 'GRAPH::Back' },
                { PrimaryKey: 'D', DataCategory: 'GRAPH::Forward' },
                { PrimaryKey: 'D', DataCategory: 'GRAPH::Back' },
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory', 'invalidatedAt', 'cachedAt', 'edgeSet', 'cache']
        })
        expect(secondResult).toEqual([
            {
                PrimaryKey: 'A',
                forward: {
                    edges: [
                        { target: 'B', context: '' },
                        { target: 'C', context: '' }
                    ],
                    cache: [
                        { source: 'A', target: 'B', context: '' },
                        { source: 'A', target: 'C', context: '' },
                        { source: 'B', target: 'C', context: '' },
                        { source: 'C', target: 'D', context: '' }
                    ],
                    cachedAt: 900
                },
                back: { edges: [], cache: [], cachedAt: 1000 }
            },
            {
                PrimaryKey: 'B',
                forward: {
                    edges: [{ target: 'C', context: '' }],
                    cache: [
                        { source: 'B', target: 'C', context: '' },
                        { source: 'C', target: 'D', context: '' }
                    ],
                    cachedAt: 1000
                },
                back: {
                    edges: [{ target: 'A', context: '' }],
                    cache: [{ source: 'A', target: 'B', context: '' }],
                    cachedAt: 900
                }
            },
            {
                PrimaryKey: 'C',
                forward: {
                    edges: [{ target: 'D', context: '' }],
                },
                back: {
                    edges: [
                        { target: 'A', context: '' },
                        { target: 'B', context: '' }
                    ],
                    cache: [
                        { source: 'A', target: 'C', context: '' },
                        { source: 'A', target: 'B', context: '' },
                        { source: 'B', target: 'C', context: '' }
                    ],
                    cachedAt: 1000
                }
            },
            {
                PrimaryKey: 'D',
                forward: { edges: [], cache: [], cachedAt: 1000 },
                back: { edges: [{ target: 'C', context: '' }] }
            }
        ])
    })
})