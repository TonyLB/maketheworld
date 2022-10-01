import { TransactWriteItem } from "@aws-sdk/client-dynamodb"
import { marshall } from "@aws-sdk/util-dynamodb"
import { ephemeraDB, exponentialBackoffWrapper, multiTableTransactWrite } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey, RoomKey, splitType } from "@tonylb/mtw-utilities/dist/types"
import internalCache from "../internalCache"
import { ExecuteActionMessage, LegalCharacterColor, MessageBus, PublishMessage } from "../messageBus/baseClasses"
import { produce } from 'immer'
import { sandboxedExecution } from '../computation/sandbox'
import { tagFromEphemeraId } from "../internalCache/dependencyGraph"
import { defaultColorFromCharacterId } from "@tonylb/mtw-utilities/dist/selfHealing"

export const executeActionMessage = async ({ payloads, messageBus }: { payloads: ExecuteActionMessage[]; messageBus: MessageBus }): Promise<void> => {
    //
    // Because each successive action can (in theory) depend upon an entire dependency cascade, each run of this layer
    // accepts only the first payload, and defers all others
    //
    payloads.slice(1).forEach((payload) => { messageBus.send(payload) })
    const payload = payloads[0]
    if (!payload) {
        return
    }
    const { rootAsset, src } = (await ephemeraDB.getItem<{ rootAsset: string, src: string }>({
        EphemeraId: payload.actionId,
        DataCategory: 'Meta::Action',
        ProjectionFields: ['rootAsset', 'src']
    })) || {}
    if (!rootAsset || !src) {
        return
    }
    const [roomFetch, characterMeta, assetMap] = await Promise.all([
        ephemeraDB.query<{ EphemeraId: string; key: string; }[]>({
            IndexName: 'DataCategoryIndex',
            DataCategory: AssetKey(rootAsset),
            KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
            ExpressionAttributeValues: {
                ':ephemeraPrefix': 'ROOM'
            },
            ExpressionAttributeNames: {
                '#key': 'key'
            },
            ProjectionFields: ['EphemeraId', '#key']
        }),
        internalCache.CharacterMeta.get(payload.characterId),
        internalCache.AssetMap.get(AssetKey(rootAsset))
    ])

    await exponentialBackoffWrapper(async () => {
        const assetState = await internalCache.AssetState.get(assetMap)

        let executeMessageQueue: PublishMessage[] = []
        const capitalize = (value) => ([value.slice(0, 1).toUppercase, value.slice(1)].join(''))
        const executionOutput = produce({
                ...assetState,
                ...(roomFetch.reduce((previous, { EphemeraId, key }) => ({
                    ...previous,
                    [key]: {
                        message: (message: string) => {
                            if (EphemeraId) {
                                executeMessageQueue.push({
                                    type: 'PublishMessage',
                                    targets: [{ roomId: splitType(EphemeraId)[1] }],
                                    displayProtocol: 'WorldMessage',
                                    message: [{ tag: 'String', value: message }]
                                })
                            }
                        }    
                    }
                }), {} as Partial<{ EphemeraId: string; key: string }>)),
                here: {
                    message: (message: string) => {
                        if (characterMeta.RoomId) {
                            executeMessageQueue.push({
                                type: 'PublishMessage',
                                targets: [{ roomId: characterMeta.RoomId }],
                                displayProtocol: 'WorldMessage',
                                message: [{ tag: 'String', value: message }]
                            })
                        }
                    }
                },
                me: {
                    Name: characterMeta.Name,
                    narrate: (message: string) => {
                        if (characterMeta.RoomId) {
                            executeMessageQueue.push({
                                type: 'PublishMessage',
                                targets: [{ roomId: characterMeta.RoomId }],
                                displayProtocol: 'NarrateMessage',
                                message: [{ tag: 'String', value: message }],
                                characterId: payload.characterId,
                                name: characterMeta.Name,
                                color: (characterMeta.Color as LegalCharacterColor) || defaultColorFromCharacterId(payload.characterId)
                            })
                        }
                    },
                    subject: characterMeta.Pronouns.subject,
                    Subject: capitalize(characterMeta.Pronouns.subject),
                    object: characterMeta.Pronouns.object,
                    Object: capitalize(characterMeta.Pronouns.object),
                    possessive: characterMeta.Pronouns.possessive,
                    Possessive: capitalize(characterMeta.Pronouns.possessive),
                    adjective: characterMeta.Pronouns.adjective,
                    Adjective: capitalize(characterMeta.Pronouns.adjective),
                    reflexive: characterMeta.Pronouns.reflexive,
                    Reflexive: capitalize(characterMeta.Pronouns.reflexive),
                }
            }, (draftSandbox) => {
            const transform = (globalSandbox) => (new Proxy(globalSandbox, {
                has: () => true,
                get: (target, key) => (key === Symbol.unscopables ? undefined: target[key]),
                set: (target, key, value) => {
                    if (key === Symbol.unscopables || !(key in assetState)) {
                        return false
                    }
                    else {
                        return Reflect.set(target, key, value)
                    }
                }
            }))
            sandboxedExecution(src)(transform)(draftSandbox)
        })
        const changedVariables = Object.keys(assetState)
            .filter((key) => (tagFromEphemeraId(assetMap[key]) === 'Variable'))
            .filter((key) => (executionOutput[key] !== assetState[key]))
        const unchangedVariables = Object.keys(assetState)
            .filter((key) => (tagFromEphemeraId(assetMap[key]) === 'Variable'))
            .filter((key) => (executionOutput[key] === assetState[key]))
    
        if (changedVariables.length > 0) {
            await multiTableTransactWrite([
                ...(unchangedVariables.map((key) => ({
                    ConditionCheck: {
                        TableName: 'Ephemera',
                        Key: marshall({
                            EphemeraId: assetMap[key],
                            DataCategory: `Meta::Variable`
                        }),
                        ConditionExpression: '#value = :value',
                        ExpressionAttributeNames: {
                            '#value': 'value'
                        },
                        ExpressionAttributeValues: marshall({
                            ':value': assetState[key]
                        })
                    }
                }))),
                ...(changedVariables.map((key) => ({
                    Update: {
                        TableName: 'Ephemera',
                        Key: marshall({
                            EphemeraId: assetMap[key],
                            DataCategory: 'Meta::Variable',
                        }),
                        UpdateExpression: 'SET #value = :newValue',
                        ConditionExpression: '#value = :oldValue',
                        ExpressionAttributeNames: {
                            '#value': 'value'
                        },
                        ExpressionAttributeValues: marshall({
                            ':oldValue': assetState[key],
                            ':newValue': executionOutput[key]
                        })
                    }
                })))
            ])
            changedVariables.forEach((key) => {
                internalCache.AssetState.set(assetMap[key], executionOutput[key])
                messageBus.send({
                    type: 'DependencyCascade',
                    targetId: assetMap[key]
                })
            })
            executeMessageQueue.forEach((message) => {
                messageBus.send(message)
            })
        }
    }, {
        retryErrors: ['TransactionCanceledException'],
        retryCallback: async () => {
            Object.values(assetMap).forEach((EphemeraId) => {
                internalCache.AssetState.invalidate(EphemeraId)
            })
        }
    })

}

export default executeActionMessage
