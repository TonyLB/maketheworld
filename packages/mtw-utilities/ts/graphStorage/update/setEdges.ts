import { GraphStorageDBH, updateGraphStorageBatch } from ".";
import GraphCache from "../cache";
import { GraphNodeCacheDirectEdge } from "../cache/graphNode";
import GraphOfUpdates from "./graphOfUpdates";

//
// setEdges performs the puts and deletes necessary to change what the edges of a given node currently *are*
// into a requested end state
//
export const setEdges = <C extends InstanceType<ReturnType<ReturnType<typeof GraphCache>>>, T extends string>(metaProps: { internalCache: C; dbHandler: GraphStorageDBH }) => async (itemId: T, edges: GraphNodeCacheDirectEdge[], direction: 'forward' | 'back' = 'forward'): Promise<void> => {
    const [current] = await metaProps.internalCache.Nodes.get([itemId])
    const currentEdges = current[direction].edges
    const graph = new GraphOfUpdates({}, [], {}, true)
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

    if (graph.edges.length) {
        await updateGraphStorageBatch(metaProps)(graph)
    }
}

export default setEdges
