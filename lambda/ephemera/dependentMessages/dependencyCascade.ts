import { TransactWriteItem } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"
import { ephemeraDB, exponentialBackoffWrapper, multiTableTransactWrite } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { deepEqual } from "@tonylb/mtw-utilities/dist/objects"
import internalCache from "../internalCache"
import { AssetStateMapping } from "../internalCache/assetState"
import { DependencyCascadeMessage, DependencyNodeNonAsset, MessageBus } from "../messageBus/baseClasses"

const dependencyTreeToTargets = (tree: DependencyNodeNonAsset[]): string[] => {
    const directTargets = tree.map(({ EphemeraId }) => (EphemeraId))
    const indirectTargets = tree.reduce((previous, { connections }) => ([
        ...previous,
        ...connections
    ]), [] as DependencyNodeNonAsset[])
    return unique(directTargets, dependencyTreeToTargets(indirectTargets)) as string[]
}

export const dependencyCascadeMessage = async ({ payloads, messageBus }: { payloads: DependencyCascadeMessage[]; messageBus: MessageBus }): Promise<void> => {
    //
    // knockOnCascades are EphemeraIds that exist in the Descent arguments of an incoming payload.  These are,
    // in other words, items for which we might be creating a *new* cascade as part of calculation.  Therefore,
    // we don't want to execute them *first* (when we might need to queue them for evaluation again after
    // changes to their dependencies)
    //
    const knockOnCascades = dependencyTreeToTargets(payloads.reduce((previous, { Descent }) => ([
        ...previous,
        ...Descent
    ]), [] as DependencyNodeNonAsset[]))

    let deferredPayloads = payloads
        .filter(({ targetId }) => (knockOnCascades.includes(targetId)))
        .reduce((previous, message) => ({ ...previous, [message.targetId]: message }), {} as Record<string, DependencyCascadeMessage>)
    const readyPayloads = payloads
        .filter(({ targetId }) => (!(knockOnCascades.includes(targetId))))

    const processOneMessage = async ({ targetId, tag, Descent }: DependencyCascadeMessage): Promise<void> => {
        switch(tag) {
            case 'Computed':
                await exponentialBackoffWrapper(async () => {
                    const fetchComputed = await ephemeraDB.getItem<{ Ancestry: DependencyNodeNonAsset[]; src: string; value: any }>({
                        EphemeraId: targetId,
                        DataCategory: 'Meta::Computed',
                        ProjectionFields: ['Ancestry', 'src', '#value'],
                        ExpressionAttributeNames: {
                            '#value': 'value'
                        }
                    })
                    if (!fetchComputed) {
                        return
                    }
                    //
                    // TODO: Create a smaller AssetStateMapping denormalization of the top level of the Ancestry,
                    // for faster fetching
                    //
                    const { Ancestry, src, value } = fetchComputed
                    const assetStateMap: AssetStateMapping = Ancestry
                        .reduce((previous, { EphemeraId, key, tag }) => (
                            (key && (tag === 'Variable' || tag === 'Computed')) ? { ...previous, [key]: { EphemeraId, tag } } : previous
                        ), {} as AssetStateMapping)
                    const assetState = await internalCache.AssetState.get(assetStateMap)
                    const conditionChecks: TransactWriteItem[] = Object.entries(assetState)
                        .map(([key, value]) => ({
                            ConditionCheck: {
                                TableName: 'Ephemera',
                                Key: marshall({
                                    EphemeraId: assetStateMap[key].EphemeraId,
                                    DataCategory: `Meta::${assetStateMap[key].tag}`
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
                                    UpdateExpression: '#value = :value',
                                    ExpressionAttributeNames: {
                                        '#value': 'value'
                                    },
                                    ExpressionAttributeValues: marshall({
                                        ':value': value
                                    })
                                }
                            }
                        ])
                        //
                        // TODO: Wrap the above in the try/catch and invalidate caches before re-throwing the
                        // error in order to reactivate the exponentialBackoff wrapper
                        //
                        Descent.forEach(({ EphemeraId, tag, connections }) => {
                            deferredPayloads[EphemeraId] = {
                                type: 'DependencyCascade',
                                targetId: EphemeraId,
                                tag,
                                Descent: connections
                            }
                        })
                    }
                },
                { retryErrors: ['TransactionCanceledException'] }
            )
        }
    }
    await Promise.all(readyPayloads.map(processOneMessage))

    //
    // TODO: Design DependencyCascade handling for Room dependencyNodes
    //

    Object.values(deferredPayloads).forEach(messageBus.send)
}

export default dependencyCascadeMessage
