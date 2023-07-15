import { Constructor, DBHandlerBase, DBHandlerLegalKey } from "../../dynamoDB/baseClasses";
import withGetOperations from "../../dynamoDB/mixins/get";
import { CacheConstructor } from "./baseClasses";
import { DeferredCache } from "./deferredCache";

export type GraphNodeCacheDirectEdge <K extends string> = {
    target: K;
    context: string;
}

type GraphNodeCacheEdge <K extends string> = GraphNodeCacheDirectEdge<K> & { source: K }

type GraphNodeCacheComponent <K extends string> = {
    edges: GraphNodeCacheDirectEdge<K>[];
    cache?: GraphNodeCacheEdge<K>[];
    invalidatedAt?: number;
    updatedAt?: number;
    cachedAt?: number;    
}

export type GraphNodeCache <K extends string> = {
    PrimaryKey: K;
    forward: GraphNodeCacheComponent<K>;
    back: GraphNodeCacheComponent<K>;
}

export type GraphDBHandler<T extends string = string> = InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey', T>>>>

type DBHandlerBatchGetReturn <K extends string> = {
    PrimaryKey: K;
    DataCategory: string;
    invalidatedAt?: number;
    cachedAt?: number;
    edgeSet: string[];
    cache: string[]
}

export class GraphNodeData <K extends string, DBH extends InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>>> {
    _Cache: DeferredCache<GraphNodeCache<K>>;
    _dbHandler: DBH;
    
    constructor(dbHandler: DBH) {
        this._dbHandler = dbHandler
        this._Cache = new DeferredCache<GraphNodeCache<K>>({
            defaultValue: (PrimaryKey: string) => ({
                PrimaryKey: PrimaryKey as K,
                forward: {
                    edges: []
                },
                back: {
                    edges: []
                },
            })
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
    }

    invalidate(key: K) {
        this._Cache.invalidate(key)
    }

    async get(PrimaryKeys: K[]): Promise<GraphNodeCache<K>[]> {
        this._Cache.add({
            promiseFactory: async (keys: string[]): Promise<DBHandlerBatchGetReturn<K>[]> => (
                this._dbHandler.getItems<{ PrimaryKey: K; DataCategory: string; invalidatedAt?: number; cachedAt?: number; edgeSet: string[]; cache: string[] }>({
                    Keys: keys.map((key) => ([
                        {
                            PrimaryKey: key as K,
                            DataCategory: 'GRAPH::Forward'
                        },
                        {
                            PrimaryKey: key as K,
                            DataCategory: 'GRAPH::Back'
                        }
                    ])).flat(1),
                    ProjectionFields: ['PrimaryKey', 'DataCategory', 'invalidatedAt', 'cachedAt', 'edgeSet', 'cache']
                })
            ),
            requiredKeys: PrimaryKeys,
            transform: (items: DBHandlerBatchGetReturn<K>[]): Record<string, GraphNodeCache<K>> => {
                const combinedValue = items.reduce<Record<string, GraphNodeCache<K>>>((previous, item) => {
                    const priorMatch = previous[item.PrimaryKey]
                    if (item.DataCategory === 'GRAPH::Forward') {
                        return {
                            ...previous,
                            [item.PrimaryKey]: {
                                PrimaryKey: item.PrimaryKey,
                                forward: {
                                    edges: item.edgeSet.map((edgeKey) => ({ target: edgeKey.split('::')[0] as K, context: edgeKey.split('::').slice(1).join('::') })),
                                    cache: (typeof item.cache !== 'undefined') ? item.cache.map((edgeKey) => ({ source: edgeKey.split('::')[0] as K, target: edgeKey.split('::')[1] as K, context: edgeKey.split('::').slice(2).join('::') })) : undefined,
                                    invalidateAt: item.invalidatedAt,
                                    cachedAt: item.cachedAt
                                },
                                back: priorMatch?.back || { edges: [] }
                            }
                        }
                    }
                    if (item.DataCategory === 'GRAPH::Back') {
                        return {
                            ...previous,
                            [item.PrimaryKey]: {
                                PrimaryKey: item.PrimaryKey,
                                forward: priorMatch?.forward || { edges: [] },
                                back: {
                                    edges: item.edgeSet.map((edgeKey) => ({ target: edgeKey.split('::')[0] as K, context: edgeKey.split('::').slice(1).join('::') })),
                                    cache: (typeof item.cache !== 'undefined') ? item.cache.map((edgeKey) => ({ source: edgeKey.split('::')[0] as K, target: edgeKey.split('::')[1] as K, context: edgeKey.split('::').slice(2).join('::') })) : undefined,
                                    invalidateAt: item.invalidatedAt,
                                    cachedAt: item.cachedAt
                                }
                            }
                        }
                    }
                    return previous
                }, {})
                return combinedValue
            }
        })
        return await Promise.all(PrimaryKeys.map((key) => (this._Cache.get(key))))
    }

}

export const GraphNode = <K extends string, DBH extends InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>>>(dbHandler: DBH) => <GBase extends CacheConstructor>(Base: GBase) => {
    return class GraphNodeCache extends Base {
        Nodes: GraphNodeData<K, DBH>;

        constructor(...rest: any) {
            super(...rest)
            this.Nodes = new GraphNodeData(dbHandler)
        }
        override clear() {
            this.Nodes.clear()
            super.clear()
        }
        override async flush() {
            await Promise.all([
                this.Nodes.flush(),
                super.flush()
            ])
        }
    }
}

export default GraphNode
