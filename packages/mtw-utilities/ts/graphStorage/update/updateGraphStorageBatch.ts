import GraphOfUpdates, { GraphOfUpdatesEdge, GraphOfUpdatesNode, GraphStorageDBH } from './baseClasses'
import GraphCache from "../cache"
import { GraphEdge } from "../utils/graph/baseClasses"
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

    //
    // kargerSteinBreakdown recursively applies the kargerStein algorithm to make smaller and smaller
    // cutSets (by separating out subGraphs under the threshold) until it reaches a list of (possibly
    // intersecting) edgesets that can be updated inside the threshold limits.
    //
    const kargerSteinBreakdown = (graph: GraphOfUpdates): GraphOfUpdates[] => {
        const { subGraphs, cutSet } = kargerStein(graph, metaProps.threshold || 50)
        if (Object.keys(cutSet.nodes).length) {
            return [
                ...subGraphs,
                ...kargerSteinBreakdown(cutSet)
            ]
        }
        return subGraphs
    }

    graph.edges = graph.edges.filter(({ action, from, to, context }) => (action === 'put' || graph.nodes[from]?.forward?.edges.find(({ target, context: checkContext }) => (target === to && context === checkContext))))

    graph.edges.forEach((edge) => {
        checkUpdateAgainstCurrent(graph, edge, 'forward')
        checkUpdateAgainstCurrent(graph, edge, 'back')
    })

    await Promise.all(kargerSteinBreakdown(graph).map(async (subGraph: GraphOfUpdates) => {
    
        const updateTransaction = (dbHandler: GraphStorageDBH) => (graph: GraphOfUpdates, key: string, direction: 'forward' | 'back', moment: number): Promise<void>[] => {
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
            return [
                dbHandler.setOperation({
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
                })
            ]
        }
    
        const moment = Date.now()
        const nodeList = Object.values(subGraph.nodes) as GraphOfUpdatesNode[]

        const batchWrites = subGraph.edges.map(({ from, to, context, action, ...rest }) => (
            action === 'put'
            ? {
                PutRequest: {
                    PrimaryKey: from,
                    DataCategory: `Graph::${to}${context ? `::${context}` : ''}`,
                    ...rest
                }
            }
            : {
                DeleteRequest: {
                    PrimaryKey: from,
                    DataCategory: `Graph::${to}${context ? `::${context}` : ''}`
                }
            }

        ))
        const transactions: Promise<any>[] = [
            ...nodeList
                .filter(({ needsForwardUpdate, forward }) => (needsForwardUpdate || !forward))
                .map(({ key }) => (updateTransaction(metaProps.dbHandler)(subGraph, key, 'forward', moment)))
                .flat(),
            ...nodeList
                .filter(({ needsBackUpdate, back }) => (needsBackUpdate || !back))
                .map(({ key }) => (updateTransaction(metaProps.dbHandler)(subGraph, key, 'back', moment)))
                .flat(),
            metaProps.dbHandler.batchWriteDispatcher(batchWrites)
        ]
    
        await Promise.all(transactions)
    
    }))
}

export default updateGraphStorageBatch
