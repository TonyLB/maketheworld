import { TransactWriteItem } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"
import { isEphemeraComputedId, isEphemeraMapId, isEphemeraRoomId, isEphemeraVariableId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { nonLegacyEphemeraDB as ephemeraDB, exponentialBackoffWrapper, multiTableTransactWrite } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { deepEqual } from "@tonylb/mtw-utilities/dist/objects"
import internalCache from "../internalCache"
import { DependencyNode, isLegalDependencyTag } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import { extractConstrainedTag } from "@tonylb/mtw-utilities/dist/types"
import { DependencyCascadeMessage, MessageBus } from "../messageBus/baseClasses"

export const dependencyCascadeMessage = async ({ payloads, messageBus }: { payloads: DependencyCascadeMessage[]; messageBus: MessageBus }): Promise<void> => {
    //
    // knockOnCascades are EphemeraIds that exist in the Descent arguments of an incoming payload.  These are,
    // in other words, items for which we might be creating a *new* cascade that would revisit the same node.  Therefore,
    // we don't want to execute them *first* (when we might need to queue them for evaluation again after
    // changes to their dependencies)
    //
    await internalCache.Descent.getBatch(payloads.map(({ targetId }) => (targetId)))
    const allGenerations = internalCache.Descent.generationOrder(payloads.map(({ targetId }) => (targetId)))
    const firstGeneration = allGenerations.length > 0 ? allGenerations[0] : []

    let deferredPayloads = payloads
        .filter(({ targetId }) => (!(firstGeneration.includes(targetId))))
        .reduce((previous, message) => ({ ...previous, [message.targetId]: message }), {} as Record<string, DependencyCascadeMessage>)
    const readyPayloads = payloads
        .filter(({ targetId }) => (firstGeneration.includes(targetId)))

    const processOneMessage = async ({ targetId }: DependencyCascadeMessage): Promise<void> => {
        if (isEphemeraComputedId(targetId)) {
            await exponentialBackoffWrapper(async () => {
                const fetchComputed = await ephemeraDB.getItem<{ Ancestry: DependencyNode[]; src: string; value: any }>({
                    Key: {
                        EphemeraId: targetId,
                        DataCategory: 'Meta::Computed'
                    },
                    ProjectionFields: ['src', 'value']
                })
                if (!fetchComputed) {
                    return
                }
                //
                // TODO: Create a smaller AssetStateMapping denormalization of the top level of the Ancestry,
                // for faster fetching
                //
                const { src, value } = fetchComputed
                const assetStateMap = await internalCache.AssetMap.get(targetId)
                const assetState = await internalCache.AssetState.get(assetStateMap)
                //
                // TODO:  Do NOT ConditionCheck against Ephemera that have been directly overriden in the cache ... they've been set too
                // recently to be confident of their eventually-consistent status
                //
                const conditionChecks: TransactWriteItem[] = Object.entries(assetState)
                    .filter(([key]) => (!internalCache.AssetState.isOverridden(assetStateMap[key])))
                    .map(([key, value]) => ({
                        ConditionCheck: {
                            TableName: 'Ephemera',
                            Key: marshall({
                                EphemeraId: assetStateMap[key],
                                DataCategory: `Meta::${extractConstrainedTag(isLegalDependencyTag)(assetStateMap[key])}`
                            }),
                            ConditionExpression: '#value = :value',
                            ExpressionAttributeNames: {
                                '#value': 'value'
                            },
                            ExpressionAttributeValues: marshall({
                                ':value': value
                            })
                        }
                    }))
                const computed = await internalCache.EvaluateCode.get({ mapping: assetStateMap, source: src })
                if (!deepEqual(computed, value)) {
                    await multiTableTransactWrite([
                        ...conditionChecks,
                        {
                            Update: {
                                TableName: 'Ephemera',
                                Key: marshall({
                                    EphemeraId: targetId,
                                    DataCategory: 'Meta::Computed'
                                }),
                                UpdateExpression: 'SET #value = :value',
                                ExpressionAttributeNames: {
                                    '#value': 'value'
                                },
                                ExpressionAttributeValues: marshall({
                                    ':value': isNaN(computed) ? 0 : computed ?? false
                                })
                            }
                        }
                    ])
                    //
                    // TODO: Wrap the above in the try/catch and invalidate caches before re-throwing the
                    // error in order to reactivate the exponentialBackoff wrapper
                    //
                    internalCache.AssetState.set(targetId, isNaN(computed) ? 0 : computed)
                    const allDescendants = internalCache.Descent.getPartial(targetId)
                        .filter(({ EphemeraId }) => (EphemeraId !== targetId))
                        .map(({ EphemeraId }) => (EphemeraId))
                    allDescendants.forEach((EphemeraId) => {
                        deferredPayloads[EphemeraId] = {
                            type: 'DependencyCascade',
                            targetId: EphemeraId
                        }
                    })
                }
            },
            { retryErrors: ['TransactionCanceledException'] })
        }
        if (isEphemeraVariableId(targetId)) {
            const variableDescendants = internalCache.Descent.getPartial(targetId)
                .filter(({ EphemeraId }) => (EphemeraId !== targetId))
                .map(({ EphemeraId }) => (EphemeraId))
            variableDescendants.forEach((EphemeraId) => {
                deferredPayloads[EphemeraId] = {
                    type: 'DependencyCascade',
                    targetId: EphemeraId
                }
            })
        }
        if (isEphemeraMapId(targetId)) {
            //
            // TODO: Optimize map dependency cascades so that they only happen when there has been
            // either (a) an update of the map itself or (b) an update of the name or exits of an
            // attached room
            //
            messageBus.send({
                type: 'MapUpdate',
                mapId: targetId
            })
        }
        if (isEphemeraRoomId(targetId)) {
            messageBus.send({
                type: 'Perception',
                ephemeraId: targetId,
                header: true
            })
            const roomDescendants = internalCache.Descent.getPartial(targetId)
                .filter(({ EphemeraId }) => (EphemeraId !== targetId))
                .map(({ EphemeraId }) => (EphemeraId))
            roomDescendants.forEach((EphemeraId) => {
                deferredPayloads[EphemeraId] = {
                    type: 'DependencyCascade',
                    targetId: EphemeraId
                }
            })
        }
    }
    await Promise.all(readyPayloads.map(processOneMessage))

    Object.values(deferredPayloads).forEach((payload) => { messageBus.send(payload) })
}

export default dependencyCascadeMessage
