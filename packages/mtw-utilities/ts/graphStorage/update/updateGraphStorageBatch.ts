import GraphOfUpdates, { GraphOfUpdatesEdge, GraphOfUpdatesNode, GraphStorageDBH } from './baseClasses'
import GraphCache from "../cache"
import { GraphEdge } from "../utils/graph/baseClasses"
import { TransactionRequest } from "../../dynamoDB/mixins/transact"
import kargerStein from "../utils/graph/kargerStein"
import { marshall } from '@aws-sdk/util-dynamodb'

const capitalize = (value: string) => (`${value.slice(0, 1).toUpperCase()}${value.slice(1)}`)

export const updateGraphStorageBatch = <C extends InstanceType<ReturnType<ReturnType<typeof GraphCache>>>>(metaProps: { internalCache: C; dbHandler: GraphStorageDBH; threshold?: number; preCalculated?: boolean }) => async (graph: GraphOfUpdates): Promise<void> => {
    const fetchedNodes = await metaProps.internalCache.Nodes.get((Object.values(graph.nodes) as { key: string }[]).map(({ key }) => (key)))
    fetchedNodes.forEach(({ PrimaryKey, ...nodeCache }) => (graph.setNode(PrimaryKey, { key: PrimaryKey, ...nodeCache })))

    const checkUpdateAgainstCurrent = (graph: GraphOfUpdates, edge: GraphEdge<string, GraphOfUpdatesEdge>, direction: 'forward' | 'back' ) => {
        const { context, action } = edge
        const { from, to } = direction === 'forward' ? { from: edge.from, to: edge.to } : { from: edge.to, to: edge.from }
        const perfectDuplicate = (graph.nodes[from]?.[direction]?.edges || []).find(({ target, context: checkContext }) => (target === to && checkContext === context))
        const nearDuplicate = (graph.nodes[from]?.[direction]?.edges || []).find(({ target, context: checkContext }) => (target === to && checkContext !== context))
        if ((action === 'put' && !perfectDuplicate) || (action === 'delete' && perfectDuplicate)) {
            graph.setNode(from, { [`needs${capitalize(direction)}Update`]: true })
            if (!nearDuplicate) {
                graph.setNode(from, { [`needs${capitalize(direction)}Invalidate`]: true })
            }
        }
    }

    graph.edges = graph.edges.filter(({ action, from, to, context }) => (action === 'put' || graph.nodes[from]?.forward?.edges.find(({ target, context: checkContext }) => (target === to && context === checkContext))))

    //
    // Check if current graph is split into smaller chunks by Karger-Stein algorithm and recurse if needed
    //
    const { subGraphs, cutSet } = kargerStein(graph, metaProps.threshold || 50)
    if (Object.keys(cutSet.nodes).length) {
        await Promise.all(subGraphs.map((subGraph) => (subGraph.clone())).map(updateGraphStorageBatch(metaProps)))
        await updateGraphStorageBatch(metaProps)(cutSet.clone())
        return
    }

    graph.edges.forEach((edge) => {
        checkUpdateAgainstCurrent(graph, edge, 'forward')
        checkUpdateAgainstCurrent(graph, edge, 'back')
    })

    const updateTransaction = (graph: GraphOfUpdates, key: string, direction: 'forward' | 'back', moment: number): TransactionRequest<'PrimaryKey'>[] => {
        const node = graph.nodes[key]
        if (!node) {
            throw new Error('Cannot update node with no actions in GraphStorage update')
        }
        let addItems: string[] = []
        let deleteItems: string[] = []
        switch(direction) {
            case 'forward':
                addItems = graph.edges.filter(({ from, action }) => (action === 'put' && from === key)).map(({ to, context }) => (`${to}${context ? `::${context}` : ''}`))
                deleteItems = graph.edges.filter(({ from, action }) => (action === 'delete' && from === key)).map(({ to, context }) => (`${to}${context ? `::${context}` : ''}`))
                break
            case 'back':
                addItems = graph.edges.filter(({ to, action }) => (action === 'put' && to === key)).map(({ from, context }) => (`${from}${context ? `::${context}` : ''}`))
                deleteItems = graph.edges.filter(({ to, action }) => (action === 'delete' && to === key)).map(({ from, context }) => (`${from}${context ? `::${context}` : ''}`))
                break
        }
        if (addItems.length === 0 && deleteItems.length === 0) {
            return []
        }
        const needsInvalidate = Boolean(node[`needs${capitalize(direction)}Invalidate`])
        return [{
            SetOperation: {
                Key: {
                    PrimaryKey: key,
                    DataCategory: `Graph::${capitalize(direction)}`,                
                },
                attributeName: 'edgeSet',
                addItems,
                deleteItems,
                setUpdate: {
                    UpdateExpression: needsInvalidate ? 'SET updatedAt = :moment, invalidatedAt = :moment' : 'SET updatedAt = :moment',
                    ExpressionAttributeValues: marshall({ ':moment': moment })
                }
            }
        }]
    }

    const moment = Date.now()
    const nodeList = Object.values(graph.nodes) as GraphOfUpdatesNode[]
    const transactions: TransactionRequest<'PrimaryKey'>[] = [
        ...nodeList
            .filter(({ needsForwardUpdate, forward }) => (needsForwardUpdate || !forward))
            .map(({ key }) => (updateTransaction(graph, key, 'forward', moment))).flat(),
        ...nodeList
            .filter(({ needsBackUpdate, back }) => (needsBackUpdate || !back))
            .map(({ key }) => (updateTransaction(graph, key, 'back', moment))).flat(),
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

    //
    // TODO: ISS-3025, ISS-3026: Create post-update phase where all updated edge directions are re-cached, and deletes are
    // run for any that now have an absent edge set.
    //
}

export default updateGraphStorageBatch
