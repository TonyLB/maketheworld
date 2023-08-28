import { GraphNodeCacheDirectEdge } from '../cache/graphNode'
import GraphOfUpdates, { GraphStorageDBH } from './baseClasses'
import GraphCache from "../cache"
import updateGraphStorageBatch from './updateGraphStorageBatch'

type SetEdgesOptions = {
    direction?: 'forward' | 'back';
    contextFilter?: (value: string) => boolean;
}

export type SetEdgesNodeArgument<T extends string> = {
    itemId: T;
    edges: GraphNodeCacheDirectEdge[];
    options?: SetEdgesOptions
}

export class GraphUpdate<C extends InstanceType<ReturnType<ReturnType<typeof GraphCache>>>, T extends string> {
    internalCache: C;
    dbHandler: GraphStorageDBH;
    threshold: number = 50;
    setEdgePayloads: SetEdgesNodeArgument<T>[] = [];

    constructor(props: { internalCache: C; dbHandler: GraphStorageDBH; threshold?: number }) {
        const { internalCache, dbHandler, threshold } = props
        this.internalCache = internalCache
        this.dbHandler = dbHandler
        if (typeof threshold !== 'undefined') {
            this.threshold = threshold
        }
    }

    setEdges(nodeUpdates: SetEdgesNodeArgument<T>[]): void {
        this.setEdgePayloads = [
            ...this.setEdgePayloads,
            ...nodeUpdates
        ]
    }

    async flush() {
        const graph = new GraphOfUpdates({}, [], {}, true)
        //
        // Pre-warm the cache with a batch load of all the items that will be needed
        //
        this.internalCache.Nodes.get(this.setEdgePayloads.map(({ itemId }) => (itemId)))
        //
        // Convert setEdge payloads into changes needed as expressed by put/delete actions
        //
        await Promise.all(
            this.setEdgePayloads.map(
                async ({ itemId, edges, options = {} }) => {
                    const { direction = 'forward', contextFilter } = options
                    const [current] = await this.internalCache.Nodes.get([itemId])
                    const currentEdges = current[direction].edges.filter(contextFilter ? ({ context }) => (contextFilter(context)) : () => (true))
                    edges
                        .filter((edge) => (!currentEdges.find((checkEdge) => (checkEdge.target === edge.target && checkEdge.context === edge.context))))
                        .forEach((edge) => {
                            const { from, to } = direction === 'forward' ? { from: itemId, to: edge.target } : { from: edge.target, to: itemId }
                            graph.addEdge({ from, to, context: edge.context, action: 'put' })
                        })
                    currentEdges
                        .filter((edge) => (!edges.find((checkEdge) => (checkEdge.target === edge.target && checkEdge.context === edge.context))))
                        .forEach((edge) => {
                            const { from, to } = direction === 'forward' ? { from: itemId, to: edge.target } : { from: edge.target, to: itemId }
                            graph.addEdge({ from, to, context: edge.context, action: 'delete' })
                        })
                })
        )

        //
        // If any changes are needed, apply them in batch
        //
        if (graph.edges.length) {
            await updateGraphStorageBatch({ internalCache: this.internalCache, dbHandler: this.dbHandler, threshold: this.threshold })(graph)
        }
        this.setEdgePayloads = []
    
    }
}

export default GraphUpdate
