import { GraphNodeCacheDirectEdge } from '../cache/graphNode'
import GraphOfUpdates, { GraphOfUpdatesEdge, GraphOfUpdatesNode, GraphStorageDBH } from './baseClasses'
import GraphCache from "../cache"
import { GraphEdge } from "../utils/graph/baseClasses"
import { TransactionRequest } from "../../dynamoDB/mixins/transact"
import kargerStein from "../utils/graph/kargerStein"

const capitalize = (value: string) => (`${value.slice(0, 1).toUpperCase()}${value.slice(1)}`)

export const updateGraphStorageBatch = <C extends InstanceType<ReturnType<ReturnType<typeof GraphCache>>>>(metaProps: { internalCache: C; dbHandler: GraphStorageDBH; threshold?: number }) => async (graph: GraphOfUpdates): Promise<void> => {
    const fetchedNodes = await metaProps.internalCache.Nodes.get((Object.values(graph.nodes) as { key: string }[]).map(({ key }) => (key)))
    fetchedNodes.forEach(({ PrimaryKey, ...nodeCache }) => (graph.setNode(PrimaryKey, { key: PrimaryKey, ...nodeCache })))

    const checkUpdateAgainstCurrent = (graph: GraphOfUpdates, edge: GraphEdge<string, GraphOfUpdatesEdge>, direction: 'forward' | 'back' ) => {
        const { context, action } = edge
        const { from, to } = direction === 'forward' ? { from: edge.from, to: edge.to } : { from: edge.to, to: edge.from }
        const perfectDuplicate = (graph.nodes[from]?.[direction]?.edges || []).find(({ target, context: checkContext }) => (target === to && checkContext === context))
        const nearDuplicate = (graph.nodes[from]?.[direction]?.edges || []).find(({ target, context: checkContext }) => (target === to && checkContext !== context))
        if ((action === 'put' && !perfectDuplicate) || (action === 'delete' && perfectDuplicate)) {
            const previousNode = graph.nodes?.[from]?.[direction]
            const addToList: GraphNodeCacheDirectEdge[] = action === 'put' ? [{ target: to, context }] : []
            graph.setNode(from, {
                [`needs${capitalize(direction)}Update`]: true,
                [direction]: previousNode
                    ? {
                        ...previousNode,
                        edges: [
                            ...(previousNode.edges || []).filter(({ target, context: checkContext }) => (target !== to || context !== checkContext)),
                            ...addToList
                        ]
                    }
                    : {
                        edges: addToList
                    }
            })
            if (!nearDuplicate) {
                graph.setNode(from, { [`needs${capitalize(direction)}Invalidate`]: true })
            }
        }
    }

    graph.edges = graph.edges.filter(({ action, from, to, context }) => (action === 'put' || graph.nodes[from]?.forward?.edges.find(({ target, context: checkContext }) => (target === to && context === checkContext))))
    graph.edges.forEach((edge) => {
        checkUpdateAgainstCurrent(graph, edge, 'forward')
        checkUpdateAgainstCurrent(graph, edge, 'back')
    })

    //
    // Check if current graph is split into smaller chunks by Karger-Stein algorithm and recurse if needed
    //
    const { subGraphs, cutSet } = kargerStein(graph, metaProps.threshold || 50)
    if (Object.keys(cutSet.nodes).length) {
        await Promise.all(subGraphs.map(updateGraphStorageBatch(metaProps)))
        await updateGraphStorageBatch(metaProps)(cutSet)
        return
    }

    const updateTransaction = (graph: GraphOfUpdates, key: string, direction: 'forward' | 'back', moment: number): TransactionRequest<'PrimaryKey'> => {
        const node = graph.nodes[key]
        if (!node) {
            throw new Error('Cannot update node with no actions in GraphStorage update')
        }
        const needsInvalidate = Boolean(node[`needs${capitalize(direction)}Invalidate`])
        const newEdgeSet = (graph.nodes[key]?.[direction]?.edges || []).map(({ target, context }) => (`${target}${ context ? `::${context}` : ''}`))
        return {
            Update: {
                Key: {
                    PrimaryKey: key,
                    DataCategory: `Graph::${capitalize(direction)}`,                
                },
                updateKeys: ['edgeSet', 'updatedAt', 'invalidatedAt'],
                updateReducer: (draft) => {
                    draft.edgeSet = newEdgeSet
                    draft.updatedAt = moment
                    if (needsInvalidate) {
                        draft.invalidatedAt = moment
                    }
                },
                checkKeys: ['updatedAt'],
                successCallback: (updateItem) => {
                    const { PrimaryKey, DataCategory, edgeSet, ...rest } = updateItem
                    metaProps.internalCache.Nodes.set(
                        key,
                        direction,
                        {
                            edges: (edgeSet || []).map((edgeKey) => ({ target: edgeKey.split('::')[0], context: edgeKey.split('::').slice(1).join('::') })),
                            ...rest
                        }
                    )
                }
            }
        }
    }

    const moment = Date.now()
    const nodeList = Object.values(graph.nodes) as GraphOfUpdatesNode[]
    const transactions: TransactionRequest<'PrimaryKey'>[] = [
        ...nodeList
            .filter(({ needsForwardUpdate, forward }) => (needsForwardUpdate || !forward))
            .map(({ key }) => (updateTransaction(graph, key, 'forward', moment))),
        ...nodeList
            .filter(({ needsBackUpdate, back }) => (needsBackUpdate || !back))
            .map(({ key }) => (updateTransaction(graph, key, 'back', moment))),
        ...(graph.edges.map(({ from, to, context, action, ...rest }) => (
            action === 'put'
            ? {
                Put: {
                    PrimaryKey: from,
                    DataCategory: `Graph::${to}${context ? `::${context}` : ''}`,
                    ...rest
                }
            }
            : {
                Delete: {
                    PrimaryKey: from,
                    DataCategory: `Graph::${to}${context ? `::${context}` : ''}`
                }
            }

        )))
    ]

    await metaProps.dbHandler.transactWrite(transactions)
}

export default updateGraphStorageBatch
