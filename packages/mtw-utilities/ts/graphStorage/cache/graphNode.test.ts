import withGetOperations from "../../dynamoDB/mixins/get"
import withPrimitives from "../../dynamoDB/mixins/primitives"
import { CacheBase } from "./baseClasses"
import GraphNode from './graphNode'

describe('GraphNode cache', () => {
    const dbHandler = {
        getItems: jest.fn()
    } as unknown as jest.Mocked<
        InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>> &
        InstanceType<ReturnType<ReturnType<typeof withPrimitives<'PrimaryKey'>>>>
    >
    const internalCache = new (GraphNode(dbHandler)(CacheBase))()
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('should batch-get everything in an empty cache', async () => {
        dbHandler.getItems.mockResolvedValue([
            { PrimaryKey: 'A', DataCategory: 'Graph::Forward', edgeSet: ['B::', 'C::'], cache: ['A::B::', 'A::C::', 'B::C::', 'C::D::'], cachedAt: 900 },
            { PrimaryKey: 'A', DataCategory: 'Graph::Back', edgeSet: [], cache: [], cachedAt: 1000 },
            { PrimaryKey: 'B', DataCategory: 'Graph::Back', edgeSet: ['A::'], cache: ['A::B::'], cachedAt: 900 },
            { PrimaryKey: 'B', DataCategory: 'Graph::Forward', edgeSet: ['C::'], cache: ['B::C::', 'C::D::'], cachedAt: 1000 },
            { PrimaryKey: 'C', DataCategory: 'Graph::Forward', edgeSet: ['D::'] },
            { PrimaryKey: 'C', DataCategory: 'Graph::Back', edgeSet: ['A::', 'B::'], cache: ['A::C::', 'A::B::', 'B::C::'], cachedAt: 1000 },
            { PrimaryKey: 'D', DataCategory: 'Graph::Forward', edgeSet: [], cache: [], cachedAt: 1000 },
            { PrimaryKey: 'D', DataCategory: 'Graph::Back', edgeSet: ['C::'] }
        ])
        const results = await internalCache.Nodes.get(['A', 'B', 'C', 'D'])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'A', DataCategory: 'Graph::Forward' },
                { PrimaryKey: 'A', DataCategory: 'Graph::Back' },
                { PrimaryKey: 'B', DataCategory: 'Graph::Forward' },
                { PrimaryKey: 'B', DataCategory: 'Graph::Back' },
                { PrimaryKey: 'C', DataCategory: 'Graph::Forward' },
                { PrimaryKey: 'C', DataCategory: 'Graph::Back' },
                { PrimaryKey: 'D', DataCategory: 'Graph::Forward' },
                { PrimaryKey: 'D', DataCategory: 'Graph::Back' },
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory', 'invalidatedAt', 'updatedAt', 'cachedAt', 'edgeSet', 'cache']
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
                        { from: 'A', to: 'B', context: '' },
                        { from: 'A', to: 'C', context: '' },
                        { from: 'B', to: 'C', context: '' },
                        { from: 'C', to: 'D', context: '' }
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
                        { from: 'B', to: 'C', context: '' },
                        { from: 'C', to: 'D', context: '' }
                    ],
                    cachedAt: 1000
                },
                back: {
                    edges: [{ target: 'A', context: '' }],
                    cache: [{ from: 'A', to: 'B', context: '' }],
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
                        { from: 'A', to: 'C', context: '' },
                        { from: 'A', to: 'B', context: '' },
                        { from: 'B', to: 'C', context: '' }
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
            { PrimaryKey: 'A', DataCategory: 'Graph::Forward', edgeSet: ['B::', 'C::'], cache: ['A::B::', 'A::C::', 'B::C::', 'C::D::'], cachedAt: 900 },
            { PrimaryKey: 'A', DataCategory: 'Graph::Back', edgeSet: [], cache: [], cachedAt: 1000 },
            { PrimaryKey: 'B', DataCategory: 'Graph::Back', edgeSet: ['A::'], cache: ['A::B::'], cachedAt: 900 },
            { PrimaryKey: 'B', DataCategory: 'Graph::Forward', edgeSet: ['C::'], cache: ['B::C::', 'C::D::'], cachedAt: 1000 }
        ]).mockResolvedValueOnce([
            { PrimaryKey: 'C', DataCategory: 'Graph::Forward', edgeSet: ['D::'] },
            { PrimaryKey: 'C', DataCategory: 'Graph::Back', edgeSet: ['A::', 'B::'], cache: ['A::C::', 'A::B::', 'B::C::'], cachedAt: 1000 },
            { PrimaryKey: 'D', DataCategory: 'Graph::Forward', edgeSet: [], cache: [], cachedAt: 1000 },
            { PrimaryKey: 'D', DataCategory: 'Graph::Back', edgeSet: ['C::'] }
        ])
        const results = await internalCache.Nodes.get(['A', 'B'])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'A', DataCategory: 'Graph::Forward' },
                { PrimaryKey: 'A', DataCategory: 'Graph::Back' },
                { PrimaryKey: 'B', DataCategory: 'Graph::Forward' },
                { PrimaryKey: 'B', DataCategory: 'Graph::Back' }
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory', 'invalidatedAt', 'updatedAt', 'cachedAt', 'edgeSet', 'cache']
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
                        { from: 'A', to: 'B', context: '' },
                        { from: 'A', to: 'C', context: '' },
                        { from: 'B', to: 'C', context: '' },
                        { from: 'C', to: 'D', context: '' }
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
                        { from: 'B', to: 'C', context: '' },
                        { from: 'C', to: 'D', context: '' }
                    ],
                    cachedAt: 1000
                },
                back: {
                    edges: [{ target: 'A', context: '' }],
                    cache: [{ from: 'A', to: 'B', context: '' }],
                    cachedAt: 900
                }
            }
        ])
        const secondResult = await internalCache.Nodes.get(['A', 'B', 'C', 'D'])
        expect(dbHandler.getItems).toHaveBeenCalledWith({
            Keys: [
                { PrimaryKey: 'C', DataCategory: 'Graph::Forward' },
                { PrimaryKey: 'C', DataCategory: 'Graph::Back' },
                { PrimaryKey: 'D', DataCategory: 'Graph::Forward' },
                { PrimaryKey: 'D', DataCategory: 'Graph::Back' },
            ],
            ProjectionFields: ['PrimaryKey', 'DataCategory', 'invalidatedAt', 'updatedAt', 'cachedAt', 'edgeSet', 'cache']
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
                        { from: 'A', to: 'B', context: '' },
                        { from: 'A', to: 'C', context: '' },
                        { from: 'B', to: 'C', context: '' },
                        { from: 'C', to: 'D', context: '' }
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
                        { from: 'B', to: 'C', context: '' },
                        { from: 'C', to: 'D', context: '' }
                    ],
                    cachedAt: 1000
                },
                back: {
                    edges: [{ target: 'A', context: '' }],
                    cache: [{ from: 'A', to: 'B', context: '' }],
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
                        { from: 'A', to: 'C', context: '' },
                        { from: 'A', to: 'B', context: '' },
                        { from: 'B', to: 'C', context: '' }
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