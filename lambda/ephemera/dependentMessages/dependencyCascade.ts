import { EphemeraComputedId, EphemeraVariableId, isEphemeraComputedId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { deepEqual, objectFilterEntries } from "@tonylb/mtw-utilities/dist/objects"
import internalCache from "../internalCache"
import { isLegalDependencyTag } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import { extractConstrainedTag } from "@tonylb/mtw-utilities/dist/types"
import { MessageBus } from "../messageBus/baseClasses"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { TransactionRequest } from "@tonylb/mtw-utilities/dist/dynamoDB/mixins/transact"
import { StateItemId, StateItemReturn } from "../internalCache/assetState"
import { objectEntryFilter, objectMap } from "../lib/objects"
import evaluateCode from "../computation/sandbox"

type DependencyCascadeMessage = {
    targetId: EphemeraComputedId;
} | {
    targetId: EphemeraVariableId;
    value: any;
}

type RollingResultsMap = Record<StateItemId, any>
type DependencyCascadeRollingResults = {
    dependencies: RollingResultsMap;
    values: RollingResultsMap;
}

export const dependencyCascade = async ({ payloads, messageBus }: { payloads: DependencyCascadeMessage[]; messageBus: MessageBus }): Promise<void> => {

    const descentGraph = await internalCache.Graph.get(payloads.map(({ targetId }) => (targetId)), 'forward')
    //
    // Find all the items that will not be cascaded (Variables in or out of the Graph, and Computes from outside
    // of the Graph) that are direct dependencies of a Compute item in the graph.
    //
    const allComputedIds = Object.keys(descentGraph.nodes).filter(isEphemeraComputedId)
    const allComputedGraphNodes = await internalCache.GraphNodes.get(allComputedIds)
    const allNonCascadedDependencies = unique(
        ...allComputedGraphNodes
            .map(({ back }) => (back.edges
                .map(({ target }) => (target))
                .filter((target) => (isEphemeraVariableId(target) || (isEphemeraComputedId(target) && !descentGraph.nodes[target])))
            ))
    ) as (EphemeraVariableId | EphemeraComputedId)[]
    const updatedVariableNodes = Object.assign({}, 
        ...payloads
            .filter((payload): payload is { targetId: EphemeraVariableId, value: any } => (isEphemeraVariableId(payload.targetId)))
            .map(({ targetId, value }) => ({ [targetId]: value }))
    )

    internalCache.StateCache.get(unique(allNonCascadedDependencies, allComputedIds))
    let transactWritePromises: Promise<void>[] = []

    await descentGraph.sortedWalk(async ({ keys, previous }: { keys: string[]; previous: DependencyCascadeRollingResults[] }): Promise<DependencyCascadeRollingResults> => {
        const previousDependencies = Object.assign({}, ...previous.map(({ dependencies }) => (dependencies))) as RollingResultsMap
        const previousValues = Object.assign({}, ...previous.map(({ values }) => (values))) as RollingResultsMap
        if (keys.length > 1) {
            if (keys.some(isEphemeraComputedId)) {
                throw new Error('Dependency Cascade error: Computed element in dependency loop')
            }
            //
            // Looped components should be things (like Features and Knowledge) that do not require cascade
            //
            return {
                dependencies: previousDependencies,
                values: previousValues
            }
        }
        const key = keys[0]
        if (isEphemeraVariableId(key) && typeof updatedVariableNodes[key] !== 'undefined') {
            const variableId = key
            const newValue = updatedVariableNodes[key]
            const oldValue = (await internalCache.StateCache.get([key]))?.[key]?.value
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
            return {
                dependencies: previousDependencies,
                values: {
                    ...previousValues,
                    [variableId]: newValue
                }
            }
        }
        if (isEphemeraComputedId(key)) {
            const computedId = key
            const selfFetch = (await internalCache.StateCache.get([computedId])) || {}
            const { src, value, dependencies } = selfFetch[computedId]
            const assetStateMap = await internalCache.AssetMap.get(computedId)
            //
            // TODO: Combine any new lookups (not in the previousValues map) into a newValues map
            //
            const newValueFetchKeys = Object.entries(assetStateMap)
                .filter(([_, ephemeraId]) => (!(ephemeraId in previousValues)))
                .filter(([key]) => ((dependencies || []).includes(key)))
                .map(([_, ephemeraId]) => (ephemeraId))
            const newValuesFetch = objectFilterEntries(
                objectMap(
                    await internalCache.StateCache.get(newValueFetchKeys),
                    ({ value }: StateItemReturn) => (value)
                ),
                ([key]) => (Object.values(assetStateMap).includes(key as StateItemId))
            ) as RollingResultsMap

            const newValues = Object.assign({},
                newValuesFetch,
                previousValues
            )

            const dependentAssetStateMap = objectEntryFilter(assetStateMap, ([key]) => ((dependencies || []).includes(key)))
            const sandbox = objectMap(dependentAssetStateMap, (ephemeraId) => (newValues[ephemeraId])) as Record<string, any>
            const calculatedValue = evaluateCode(`return (${src})`)({ ...sandbox })
            if (!deepEqual(calculatedValue, value)) {
                const conditionChecks: TransactionRequest<'EphemeraId', string>[] = Object.entries({ ...previousDependencies, ...newValuesFetch })
                    .map(([key, originalValue]) => ({
                        ConditionCheck: {
                            Key: {
                                EphemeraId: key,
                                DataCategory: `Meta::${extractConstrainedTag(isLegalDependencyTag)(key)}`
                            },
                            ProjectionFields: ['value'],
                            ConditionExpression: 'value = :value',
                            ExpressionAttributeValues: {
                                ':value': originalValue
                            }
                        }
                    }))
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
                return {
                    dependencies: {
                        ...previousDependencies,
                        ...newValuesFetch
                    },
                    values: {
                        ...previousValues,
                        [computedId]: calculatedValue
                    }
                }
            }
            else {
                return {
                    dependencies: {
                        [computedId]: value
                    },
                    values: {
                        ...previousValues,
                        [computedId]: calculatedValue
                    }
                }
            }
        }
        return {
            dependencies: previousDependencies,
            values: previousValues
        }
    })

    await Promise.all(transactWritePromises)

    //
    // TODO: Extend sortedWalk procedure to handle MapIds and RoomIds (sending appropriate
    // update and perception events ... see commented code below)
    //
    
    //
    // FUTURE TODO: Aggregate update transaction into a single transaction if it fits under size
    // limits, otherwise fall back on the parallel update as previous
    //


    // const processOneMessage = async ({ targetId }: DependencyCascadeMessage): Promise<void> => {

    //     if (isEphemeraMapId(targetId)) {
    //         //
    //         // TODO: Optimize map dependency cascades so that they only happen when there has been
    //         // either (a) an update of the map itself or (b) an update of the name or exits of an
    //         // attached room
    //         //
    //         messageBus.send({
    //             type: 'MapUpdate',
    //             mapId: targetId
    //         })
    //     }
    //     if (isEphemeraRoomId(targetId)) {
    //         messageBus.send({
    //             type: 'Perception',
    //             ephemeraId: targetId,
    //             header: true
    //         })
    //         const roomDescendants = internalCache.Descent.getPartial(targetId)
    //             .filter(({ EphemeraId }) => (EphemeraId !== targetId))
    //             .map(({ EphemeraId }) => (EphemeraId))
    //         roomDescendants.forEach((EphemeraId) => {
    //             deferredPayloads[EphemeraId] = {
    //                 type: 'DependencyCascade',
    //                 targetId: EphemeraId
    //             }
    //         })
    //     }
    // }
    // await Promise.all(readyPayloads.map(processOneMessage))

    // Object.values(deferredPayloads).forEach((payload) => { messageBus.send(payload) })
}

export default dependencyCascade
