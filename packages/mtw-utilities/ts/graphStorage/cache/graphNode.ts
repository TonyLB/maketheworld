import { Constructor, DBHandlerBase, DBHandlerLegalKey } from "../../dynamoDB/baseClasses";
import withGetOperations from "../../dynamoDB/mixins/get";
import { CacheConstructor, GraphDBHandler } from "./baseClasses";
import { DeferredCache } from "./deferredCache";

export type GraphNodeCacheDirectEdge <K extends string = string> = {
    target: K;
    context: string;
}

export type GraphNodeCacheEdge <K extends string> = {
    from: K;
    to: K;
    context: string;
}

type GraphNodeCacheComponent <K extends string> = {
    edges: GraphNodeCacheDirectEdge<K>[];
    cache?: GraphNodeCacheEdge<K>[];
    invalidatedAt?: number;
    updatedAt?: number;
    cachedAt?: number;    
}

export type GraphNodeCache <K extends string> = {
    PrimaryKey: K;
    direction: 'forward' | 'back'
} & GraphNodeCacheComponent<K>

export type GraphNodeResult<K extends string> = {
    PrimaryKey: K;
    forward: GraphNodeCacheComponent<K>;
    back: GraphNodeCacheComponent<K>;
}

type DBHandlerBatchGetReturn <K extends string> = {
    PrimaryKey: K;
    DataCategory: string;
    invalidatedAt?: number;
    updatedAt?: number;
    cachedAt?: number;
    edgeSet?: Set<string>;
    cache: string[]
}

const capitalize = (value: string) => ([value.slice(0, 1).toUpperCase(), value.slice(1)].join(''))

export class GraphNodeData <K extends string, DBH extends InstanceType<ReturnType<ReturnType<typeof withGetOperations<'PrimaryKey'>>>>> {
    _Cache: DeferredCache<GraphNodeCache<K>>;
    _dbHandler: DBH;
    
    constructor(dbHandler: DBH) {
        this._dbHandler = dbHandler
        this._Cache = new DeferredCache<GraphNodeCache<K>>({
            defaultValue: (cacheKey: string) => ({
                PrimaryKey: cacheKey.split('::')[0] as K,
                direction: cacheKey.split('::')[1] as 'forward' | 'back',
                edges: []
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

    async get(PrimaryKeys: K[]): Promise<GraphNodeResult<K>[]> {
        this._Cache.add({
            promiseFactory: (keys: string[]): Promise<DBHandlerBatchGetReturn<K>[]> => (
                this._dbHandler.getItems<DBHandlerBatchGetReturn<K>>({
                    Keys: keys.map((key) => ({
                        PrimaryKey: key.split('::')[0] as K,
                        DataCategory: `Graph::${capitalize(key.split('::')[1])}`
                    })),
                    ProjectionFields: ['PrimaryKey', 'DataCategory', 'invalidatedAt', 'updatedAt', 'cachedAt', 'edgeSet', 'cache']
                })
            ),
            requiredKeys: PrimaryKeys.map((primaryKey) => ([`${primaryKey}::forward`, `${primaryKey}::back`])).flat(),
            transform: (items: DBHandlerBatchGetReturn<K>[]): Record<string, GraphNodeCache<K>> => {
                const combinedValue = items.reduce<Record<string, GraphNodeCache<K>>>((previous, item) => {
                    if (!(['Graph::Forward', 'Graph::Back'].includes(item.DataCategory))) {
                        return previous
                    }
                    const direction = item.DataCategory === 'Graph::Forward' ? 'forward' : 'back'
                    return {
                        ...previous,
                        [`${item.PrimaryKey}::${direction}`]: {
                            PrimaryKey: item.PrimaryKey,
                            direction,
                            edges: ([...(item.edgeSet ?? [])]).map((edgeKey) => ({ target: edgeKey.split('::')[0] as K, context: edgeKey.split('::').slice(1).join('::') })),
                            cache: (typeof item.cache !== 'undefined') ? item.cache.map((edgeKey) => ({ from: edgeKey.split('::')[0] as K, to: edgeKey.split('::')[1] as K, context: edgeKey.split('::').slice(2).join('::') })) : undefined,
                            invalidateAt: item.invalidatedAt,
                            updatedAt: item.updatedAt,
                            cachedAt: item.cachedAt
                        }
                    }
                }, {})
                return combinedValue
            }
        })
        return await Promise.all(PrimaryKeys.map(async (key) => {
            const [{ PrimaryKey: forwardPK, direction: forwardDirection, ...forward}, { PrimaryKey: backPK, direction: backDirection, ...back}] = await Promise.all([
                this._Cache.get(`${key}::forward`),
                this._Cache.get(`${key}::back`)
            ])
            return {
                PrimaryKey: key,
                forward,
                back
            }
        }))
    }

    set(key: K, direction: 'forward' | 'back', value) {
        const cacheKey = `${key}::${direction}`
        this._Cache.set(Infinity, cacheKey, value)
    }

}

export const GraphNode = <K extends string, DBH extends GraphDBHandler>(dbHandler: DBH) => <GBase extends CacheConstructor>(Base: GBase) => {
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
