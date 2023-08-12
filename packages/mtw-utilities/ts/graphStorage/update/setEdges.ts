import { GraphStorageDBH, updateGraphStorageBatch } from ".";
import GraphCache from "../cache";
import { GraphNodeCacheDirectEdge } from "../cache/graphNode";
import GraphOfUpdates from "./graphOfUpdates";

type SetEdgesOptions = {
    direction?: 'forward' | 'back';
    contextFilter?: (value: string) => boolean;
}

type SetEdgesNodeArgument<T extends string> = {
    itemId: T;
    edges: GraphNodeCacheDirectEdge[];
    options?: SetEdgesOptions
}

//
// setEdges performs the puts and deletes necessary to change what the edges of a given node currently *are*
// into a requested end state
//
export const setEdges = <C extends InstanceType<ReturnType<ReturnType<typeof GraphCache>>>, T extends string>(metaProps: { internalCache: C; dbHandler: GraphStorageDBH }) => async (nodeUpdates: SetEdgesNodeArgument<T>[]): Promise<void> => {
    const graph = new GraphOfUpdates({}, [], {}, true)
    //
    // Pre-warm the cache with a batch load of all the items that will be needed
    //
    metaProps.internalCache.Nodes.get(nodeUpdates.map(({ itemId }) => (itemId)))
    await Promise.all(
        nodeUpdates.map(
            async ({ itemId, edges, options = {} }) => {
                const { direction = 'forward', contextFilter } = options
                const [current] = await metaProps.internalCache.Nodes.get([itemId])
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

    if (graph.edges.length) {
        await updateGraphStorageBatch(metaProps)(graph)
    }
}

export default setEdges
