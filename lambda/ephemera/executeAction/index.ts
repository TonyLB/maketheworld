import { ephemeraDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
import internalCache from "../internalCache"
import { ExecuteActionMessage, MessageBus, PerceptionShowMessage, PerceptionShowMoment, PublishMessage } from "../messageBus/baseClasses"
import { EphemeraMessageId, EphemeraMomentId, EphemeraVariableId, LegalCharacterColor } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { produce } from 'immer'
import { sandboxedExecution } from '../computation/sandbox'
import { isLegalDependencyTag } from "@tonylb/mtw-utilities/dist/graphStorage/cache/baseClasses"
import { extractConstrainedTag } from "@tonylb/mtw-utilities/dist/types"
import { defaultColorFromCharacterId } from "../lib/characterColor"
import { EphemeraRoomId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import dependencyCascade from "../dependentMessages/dependencyCascade"

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
        Key: {
            EphemeraId: payload.actionId,
            DataCategory: 'Meta::Action'
        },
        ProjectionFields: ['rootAsset', 'src']
    })) || {}
    if (!rootAsset || !src) {
        return
    }
    const [roomFetch, messageFetch, momentFetch, characterMeta, assetMap] = await Promise.all([
        //
        // TODO: Add acorn-derived dependencies to actions, and use them to limit
        // the references that get loaded (rather than running queries for every possible
        // thing)
        //
        ephemeraDB.query<{ EphemeraId: EphemeraRoomId; DataCategory: string; key: string; }>({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: AssetKey(rootAsset) },
            KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
            ExpressionAttributeValues: {
                ':ephemeraPrefix': 'ROOM'
            },
            ProjectionFields: ['EphemeraId', 'key']
        }),
        ephemeraDB.query<{ EphemeraId: EphemeraMessageId; DataCategory: string; key: string; }>({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: AssetKey(rootAsset) },
            KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
            ExpressionAttributeValues: {
                ':ephemeraPrefix': 'MESSAGE'
            },
            ProjectionFields: ['EphemeraId', 'key']
        }),
        ephemeraDB.query<{ EphemeraId: EphemeraMomentId; DataCategory: string; key: string; }>({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: AssetKey(rootAsset) },
            KeyConditionExpression: "begins_with(EphemeraId, :ephemeraPrefix)",
            ExpressionAttributeValues: {
                ':ephemeraPrefix': 'MOMENT'
            },
            ProjectionFields: ['EphemeraId', 'key']
        }),
        internalCache.CharacterMeta.get(payload.characterId),
        internalCache.AssetMap.get(AssetKey(rootAsset))
    ])

    await exponentialBackoffWrapper(async () => {
        const assetState = await internalCache.AssetState.get(assetMap)

        let executeMessageQueue: (PublishMessage | PerceptionShowMessage | PerceptionShowMoment)[] = []
        const capitalize = (value: string) => ([value.slice(0, 1).toUpperCase(), value.slice(1)].join(''))
        const executionOutput = produce({
                ...assetState,
                ...(roomFetch.reduce((previous, { EphemeraId, key }) => ({
                    ...previous,
                    [key]: {
                        message: (message: string) => {
                            if (EphemeraId) {
                                executeMessageQueue.push({
                                    type: 'PublishMessage',
                                    targets: [EphemeraId],
                                    displayProtocol: 'WorldMessage',
                                    message: [{ tag: 'String', value: message }]
                                })
                            }
                        }    
                    }
                }), {} as Partial<{ EphemeraId: string; key: string }>)),
                ...(messageFetch.reduce((previous, { EphemeraId, key }) => ({
                    ...previous,
                    [key]: {
                        show: () => {
                            if (EphemeraId) {
                                executeMessageQueue.push({
                                    type: 'Perception',
                                    ephemeraId: EphemeraId
                                })
                            }
                        }    
                    }
                }), {} as Partial<{ EphemeraId: string; key: string }>)),
                ...(momentFetch.reduce((previous, { EphemeraId, key }) => ({
                    ...previous,
                    [key]: {
                        show: () => {
                            if (EphemeraId) {
                                executeMessageQueue.push({
                                    type: 'Perception',
                                    ephemeraId: EphemeraId
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
                                targets: [characterMeta.RoomId],
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
                                targets: [characterMeta.RoomId],
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
            .filter((key) => (extractConstrainedTag(isLegalDependencyTag)(assetMap[key]) === 'Variable'))
            .filter((key) => (executionOutput[key] !== assetState[key]))
        const unchangedVariables = Object.keys(assetState)
            .filter((key) => (extractConstrainedTag(isLegalDependencyTag)(assetMap[key]) === 'Variable'))
            .filter((key) => (executionOutput[key] === assetState[key]))
    
        if (changedVariables.length > 0) {
            //
            // TODO: Refactor dependencyCascade to also accept variable-IDs that are condition-only
            // (to verify the context in which an action ran before executing its updates)
            //
            await Promise.all([
                ephemeraDB.transactWrite(
                    unchangedVariables.map((key) => ({
                        ConditionCheck: {
                            Key: {
                                EphemeraId: assetMap[key],
                                DataCategory: `Meta::Variable`
                            },
                            ProjectionFields: ['value'],
                            ConditionExpression: '#value = :value',
                            ExpressionAttributeValues: {
                                ':value': assetState[key]
                            }
                        }
                    }))
                ),
                dependencyCascade({
                    payloads: changedVariables.map((key) => ({
                        targetId: assetMap[key] as EphemeraVariableId,
                        value: executionOutput[key]
                    })),
                    messageBus
                })
            ])
        }
        executeMessageQueue.forEach((message) => {
            messageBus.send(message)
        })
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
