import { Constructor, DBHandlerBase, DBHandlerLegalKey } from "../../dynamoDB/baseClasses";
import withGetOperations from "../../dynamoDB/mixins/get";
import { GraphEdge } from "../utils/graph/baseClasses"
import { CacheConstructor, GraphDBHandler } from "./baseClasses";
import { DeferredCache } from "./deferredCache";

type GraphEdgeKey<K extends string> = `${K}::${K}` | `${K}::${K}::${string}`

export type GraphEdgeCache <K extends string, D extends {}> = {
    key: GraphEdgeKey<K>;
} & GraphEdge<K, D>

type DBHandlerBatchGetReturn <K extends string, D extends {}> = {
    PrimaryKey: K;
    DataCategory: `Graph::${K | `${K}::${string}`}`;
    data?: D
}

export class GraphEdgeData <K extends string, DBH extends GraphDBHandler, D extends {}> {
    _Cache: DeferredCache<GraphEdgeCache<K, D>, GraphEdgeKey<K>>;
    _dbHandler: DBH;
    
    constructor(dbHandler: DBH, options?: { defaultData?: () => D}) {
        this._dbHandler = dbHandler
        this._Cache = new DeferredCache<GraphEdgeCache<K, D>, GraphEdgeKey<K>>({
            defaultValue: (cacheKey: GraphEdgeKey<K>) => {
                const [to, from, context] = cacheKey.split('::')
                if (!(to && from)) {
                    throw new Error('GraphEdge cache key must include to and from')
                }
                return {
                    key: cacheKey,
                    to: to as K,
                    from: from as K,
                    context,
                    data: options?.defaultData?.() || {} as D
                }
            }
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
    }

    invalidate(key: GraphEdgeKey<K>) {
        this._Cache.invalidate(key)
    }

    async get(PrimaryKeys: { from: K; to: K, context?: string }[]): Promise<GraphEdge<K, D>[]> {
        this._Cache.add({
            promiseFactory: async (keys: GraphEdgeKey<K>[]): Promise<DBHandlerBatchGetReturn<K, D>[]> => {
                return await this._dbHandler.getItems<DBHandlerBatchGetReturn<K, D>>({
                    Keys: keys.map((key) => ({ PrimaryKey: key.split('::')[0], DataCategory: `Graph::${key.split('::').slice(1).join('::')}` })),
                    ProjectionFields: ['PrimaryKey', 'DataCategory', 'data']
                })
            },
            requiredKeys: PrimaryKeys.map(({ from, to, context }) => (`${from}::${to}${context ? `::${context}` as const : ''}` as const)),
            transform: (items: DBHandlerBatchGetReturn<K, D>[]): Record<string, GraphEdgeCache<K, D>> => {
                const combinedValue = items.reduce<Record<string, GraphEdgeCache<K, D>>>((previous, item) => {
                    const { PrimaryKey, DataCategory, data } = item
                    const key = `${PrimaryKey}::${DataCategory.split('::').slice(1).join('::')}`
                    const context = DataCategory.split('::').slice(2).join('::')
                    return {
                        ...previous,
                        [key]: {
                            key,
                            from: PrimaryKey,
                            to: DataCategory.split('::')[1],
                            context: context ? context : undefined,
                            data
                        } as GraphEdgeCache<K, D>
                    }
                }, {})
                return combinedValue
            }
        })
        return (await Promise.all(PrimaryKeys.map((key) => (this._Cache.get(`${key.from}::${key.to}${key.context ? `::${key.context}` as const : ''}` as const)))))
            .map(({ key, ...rest }) => (rest as GraphEdge<K, D>))
    }

}

export const GraphEdgeClass = <K extends string, D extends {}, DBH extends GraphDBHandler>(dbHandler: DBH) => <GBase extends CacheConstructor>(Base: GBase) => {
    return class GraphEdgeCache extends Base {
        Edges: GraphEdgeData<K, DBH, D>;

        constructor(...rest: any) {
            super(...rest)
            this.Edges = new GraphEdgeData(dbHandler)
        }
        override clear() {
            this.Edges.clear()
            super.clear()
        }
        override async flush() {
            await Promise.all([
                this.Edges.flush(),
                super.flush()
            ])
        }
    }
}

export default GraphEdgeClass
