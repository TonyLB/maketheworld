import { marshall } from '@aws-sdk/util-dynamodb';
import { unique } from '../../lists';
import { extractConstrainedTag } from '../../types';
import { Graph } from '../utils/graph';
import { GraphEdge } from '../utils/graph/baseClasses';
import { isLegalDependencyTag, GraphDBHandler } from './baseClasses'
import GraphEdgeCache, { GraphEdgeData } from './graphEdge';
import GraphNode, { GraphNodeCacheEdge, GraphNodeData } from './graphNode';
import { deepEqual } from '../../objects';

export const tagFromEphemeraId = extractConstrainedTag(isLegalDependencyTag)

type GraphCacheDataNodeType<K extends string> = {
    key: K;
    cachedAt?: number;
    cache?: GraphNodeCacheEdge<K>[];
    invalidatedAt?: number;
}

export class GraphCacheData <K extends string, DBH extends GraphDBHandler, D extends {}> {
    _Edges: GraphEdgeData<K, DBH, D>;
    _Nodes: GraphNodeData<K, DBH>;
    _dbHandler: DBH;
    _cacheWrites: Promise<void>[] = [];
    
    constructor(Nodes: GraphNodeData<K, DBH>, Edges: GraphEdgeData<K, DBH, D & { context?: string }>, dbhHandler: DBH) {
        this._Nodes = Nodes
        this._Edges = Edges
        this._dbHandler = dbhHandler
    }

    async _getIterate(nodes: K[], direction: 'forward' | 'back', previouslyVisited: K[] = []): Promise<Graph<K, GraphCacheDataNodeType<K>, { context?: string} & D>> {
        const nodesFetch = (await this._Nodes.get(nodes))
        const rootGraph = new Graph<K, GraphCacheDataNodeType<K>, D>(
            nodesFetch.reduce<Record<K, GraphCacheDataNodeType<K>>>((previous, node) => ({
                ...previous,
                [node.PrimaryKey]: {
                    key: node.PrimaryKey,
                    cachedAt: node[direction].cachedAt,
                    cache: node[direction].cache,
                    invalidatedAt: node[direction].invalidatedAt
                }
            }), {} as Record<K, GraphCacheDataNodeType<K>>),
            [],
            {},
            true
        )
        const newTargets = nodesFetch
            .reduce<K[]>((previous, nodeCache) => (
                unique(
                    previous,
                    nodeCache[direction].edges.map(({ target }) => (target)),
                    (nodeCache[direction].cache || []).map(({ to }) => (to))
                )
            ), [])
            .filter((key) => (![...previouslyVisited, ...nodes].includes(key)))
        const aggregateEdges = nodesFetch.reduce<GraphEdge<K, D>[]>((previous, nodeCache) => ([
            ...previous,
            ...nodeCache[direction].edges
                .map(({ target, context }) => ({ from: nodeCache.PrimaryKey, to: target, context } as unknown as GraphEdge<K, D>))
        ]), [])
        if (newTargets.length) {
            //
            // Prefetch child nodes in batch to facilitate graph calculations
            //
            const subGraph = await this._getIterate(newTargets, direction, [...previouslyVisited, ...nodes])
            return rootGraph.merge([subGraph], aggregateEdges)
        }
        else {
            return rootGraph.merge([], aggregateEdges)
        }

    }

    async get(nodes: K[], direction: 'forward' | 'back'): Promise<Graph<K, { key: K }, D & { context?: string }>> {
        const returnValue = await this._getIterate(nodes, direction)

        const moment = Date.now()
        const capitalize = (value: string) => ([value.slice(0, 1).toUpperCase(), value.slice(1)].join(''))
        
        const updateCachePromise = (async () => {
            await Promise.all((Object.values(returnValue.nodes) as GraphCacheDataNodeType<K>[])
                .map(async (node) => {
                    const edgeToString = ({ from, to, context }: GraphEdge<K, { context?: string }>): string => (`${from}::${to}${context ? `::${context}`: ''}`)
                    const newCache = returnValue.fromRoot(node.key).edges.map(edgeToString).sort()
                    if (!(node.cache && deepEqual(newCache, [...node.cache].map(edgeToString).sort()))) {
                        await this._dbHandler.primitiveUpdate({
                            Key: { PrimaryKey: node.key, DataCategory: `Graph::${capitalize(direction)}` },
                            UpdateExpression: 'SET cache = :newCache, cachedAt = :moment',
                            ExpressionAttributeValues: marshall({
                                ':newCache': newCache,
                                ':moment': moment
                            }),
                            ConditionExpression: 'attribute_not_exists(cachedAt) OR cachedAt < :moment'
                        })
                    }
                })
            )
        })()
        this._cacheWrites = [...this._cacheWrites, updateCachePromise]

        return returnValue
    }

    async flush() {
        await Promise.all(this._cacheWrites)
        this._cacheWrites = []
    }
}

export const GraphCache = <K extends string, D extends {}, DBH extends GraphDBHandler>(dbHandler: DBH) => <GBase extends ReturnType<ReturnType<typeof GraphNode<K, DBH>>> & ReturnType<ReturnType<typeof GraphEdgeCache<K, D, DBH>>>>(Base: GBase) => {
    return class GraphCache extends Base {
        Graph: GraphCacheData<K, DBH, D>;

        constructor(...rest: any) {
            super(...rest)
            this.Graph = new GraphCacheData(this.Nodes, this.Edges, dbHandler)
        }

        override async flush() {
            await Promise.all([
                this.Graph.flush(),
                super.flush()
            ])
        }

    }
}

export default GraphCache

