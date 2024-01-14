import { EphemeraComputedId, EphemeraVariableId, isEphemeraComputedId, isEphemeraMapId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { deepEqual } from "@tonylb/mtw-utilities/dist/objects"
import internalCache from "../internalCache"
import { isLegalDependencyTag } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import { extractConstrainedTag } from "@tonylb/mtw-utilities/dist/types"
import { MessageBus } from "../messageBus/baseClasses"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { TransactionRequest } from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/transact"
import { objectMap } from "../lib/objects"
import evaluateCode from "../computation/sandbox"
import { GraphEdge } from "@tonylb/mtw-utilities/dist/graphStorage/utils/graph/baseClasses"
import CascadeGraph from "@tonylb/mtw-utilities/dist/graphStorage/cascadeGraph"
import { Graph } from "@tonylb/mtw-utilities/dist/graphStorage/utils/graph"
import { isStateItemId } from "../internalCache/baseClasses"

type DependencyCascadeMessage = {
    targetId: EphemeraComputedId;
} | {
    targetId: EphemeraVariableId;
    value: any;
}

export const dependencyCascade = async ({ payloads, messageBus }: { payloads: DependencyCascadeMessage[]; messageBus: MessageBus }): Promise<void> => {

    const descentGraph = await internalCache.Graph.get(payloads.map(({ targetId }) => (targetId)), 'forward', { fetchEdges: true })

    //
    // Find all the items that will not be cascaded (Variables in or out of the Graph, and Computes from outside
    // of the Graph) that are direct dependencies of a Compute item in the graph.
    //
    const allComputedIds = Object.keys(descentGraph.nodes).filter(isEphemeraComputedId)
    const allComputedGraphNodes = await internalCache.GraphNodes.get(allComputedIds)

    const updatedVariableNodes = Object.assign({}, 
        ...payloads
            .filter((payload): payload is { targetId: EphemeraVariableId, value: any } => (isEphemeraVariableId(payload.targetId)))
            .map(({ targetId, value }) => ({ [targetId]: value }))
    )

    const allNonCascadedDependencyEdges: GraphEdge<string, {}>[] = allComputedGraphNodes
        .map(({ back, PrimaryKey }) => (back.edges
            .filter(({ target }) => ((isEphemeraVariableId(target) && !(target in updatedVariableNodes)) || (isEphemeraComputedId(target) && !descentGraph.nodes[target])))
            .map(({ target, ...rest }) => ({ to: PrimaryKey, from: target, ...rest }))
        )).flat(1)
    const allNonCascadedDependencies = unique(
        allNonCascadedDependencyEdges
            .map(({ from }) => (from))
            .filter((target): target is EphemeraVariableId | EphemeraComputedId => (isEphemeraVariableId(target) || (isEphemeraComputedId(target) && !descentGraph.nodes[target])))
    ) as (EphemeraVariableId | EphemeraComputedId)[]
    
    const templateNodes = Object.assign(
        {},
        objectMap(descentGraph.nodes, (incoming) => ({ ...incoming, needsProcessing: true, needsFetch: true })),
        ...(allNonCascadedDependencies.map((key) => ({ [key]: { key, needsFetch: true, needsProcessing: false } })))
    )
    const updateGraphTemplate = new Graph<string, { key: string; needsFetch?: boolean; needsProcessing?: boolean; }, {}>(
        templateNodes,
        [...descentGraph.edges, ...allNonCascadedDependencyEdges],
        {},
        true
    )

    internalCache.StateCache.get(Object.keys(updateGraphTemplate.nodes).filter((key): key is EphemeraVariableId | EphemeraComputedId => (isEphemeraVariableId(key) || isEphemeraComputedId(key))))
    let transactWritePromises: Promise<void>[] = []

    const updateGraph = new CascadeGraph<string, { key: string; needsFetch?: boolean; needsProcessing?: boolean; }, { src?: string; value: any }, { scopedId?: string }, { value: any }>({
        template: updateGraphTemplate,
        fetch: async (nodes) => (Object.entries(await internalCache.StateCache.get(nodes.filter(isStateItemId))).map(([key, { value, src }]) => ({ key, value, src }))),
        unprocessed: ({ fetch }) => (fetch ?? { value: undefined }),
        circular: async () => ({ value: '#CIRCULAR'}),
        process: async ({
            template: { key, needsProcessing },
            fetch,
            priors
        }) => {
            if (isEphemeraVariableId(key) && needsProcessing && typeof fetch?.value !== 'undefined') {
                const variableId = key
                const newValue = updatedVariableNodes[key]
                const oldValue = fetch.value
                transactWritePromises = [
                    ...transactWritePromises,
                    ephemeraDB.transactWrite([
                        {
                            PrimitiveUpdate: {
                                Key: {
                                    EphemeraId: variableId,
                                    DataCategory: 'Meta::Variable'
                                },
                                ProjectionFields: ['value'],
                                UpdateExpression: 'SET value = :newValue',
                                ConditionExpression: 'value = :oldValue',
                                ExpressionAttributeValues: {
                                    ':newValue': newValue,
                                    ':oldValue': oldValue
                                }
                            }
                        }
                    ]).then(() => {
                        internalCache.AssetState.set(variableId, isNaN(newValue) ? 0 : newValue)
                    })
                ]
                return { value: newValue }
            }
            if (isEphemeraComputedId(key) && needsProcessing && fetch?.src) {
                //
                // TODO: Refactor code for calculating computed node to accept incoming edge-template information that
                // describes how a dependency maps into the computation namespace
                //
                const computedId = key
                const { src, value } = fetch
        
                const sandbox = Object.assign({},
                        ...priors.map(({ result, edge: { scopedId } }) => (result && scopedId ? { [scopedId]: result.value } : {}))
                    )
                const calculatedValue = evaluateCode(`return (${src})`)({ ...sandbox })
                if (!deepEqual(calculatedValue, value)) {
                    const { conditionChecks } = priors
                        .reduce<{ conditionChecks: TransactionRequest<'EphemeraId', string>[], alreadyChecked: string[] }>((previous, { key, result }) => {
                            if (result && !previous.alreadyChecked.includes(key)) {
                                return {
                                    conditionChecks: [
                                        ...previous.conditionChecks,
                                        {
                                            ConditionCheck: {
                                                Key: {
                                                    EphemeraId: key,
                                                    DataCategory: `Meta::${extractConstrainedTag(isLegalDependencyTag)(key)}`
                                                },
                                                ProjectionFields: ['value'],
                                                ConditionExpression: 'value = :value',
                                                ExpressionAttributeValues: {
                                                    ':value': result.value
                                                }
                                            }
                                        }
                                    ],
                                    alreadyChecked: [...previous.alreadyChecked, key]
                                }
                            }
                            return previous
                        }, { conditionChecks: [], alreadyChecked: [] })

                    transactWritePromises = [
                        ...transactWritePromises,
                        ephemeraDB.transactWrite([
                            ...conditionChecks,
                            {
                                PrimitiveUpdate: {
                                    Key: {
                                        EphemeraId: computedId,
                                        DataCategory: 'Meta::Computed'
                                    },
                                    ProjectionFields: ['value'],
                                    UpdateExpression: 'SET value = :value',
                                    ExpressionAttributeValues: { ':value': isNaN(calculatedValue) ? 0 : calculatedValue ?? false }
                                }
                            }
                        ]).then(() => {
                            internalCache.AssetState.set(computedId, isNaN(calculatedValue) ? 0 : calculatedValue)
                        })
                    ]
                }
                return { value: calculatedValue }
            }
            
            if (isEphemeraRoomId(key)) {
                messageBus.send({
                    type: 'Perception',
                    ephemeraId: key,
                    header: true
                })
            }
            if (isEphemeraMapId(key)) {
                //
                // TODO: Optimize map dependency cascades so that they only happen when there has been
                // either (a) an update of the map itself or (b) an update of the name or exits of an
                // attached room
                //
                messageBus.send({
                    type: 'MapUpdate',
                    mapId: key
                })
            }    

            return { value: undefined }
        }
    })

    await updateGraph.execute()

    await Promise.all(transactWritePromises)

}

export default dependencyCascade
