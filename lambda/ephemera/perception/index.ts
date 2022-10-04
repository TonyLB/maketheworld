import { PerceptionMessage, MessageBus } from "../messageBus/baseClasses"
import { render } from "@tonylb/mtw-utilities/dist/perception"
import { deliverRenders } from "@tonylb/mtw-utilities/dist/perception/deliverRenders"
import internalCache from "../internalCache"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { EphemeraCharacter, EphemeraRoomAppearance, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraRoomId } from "../cacheAsset/baseClasses"
import { componentAppearanceReduce } from "./components"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { RoomDescribeData } from "@tonylb/mtw-interfaces/dist/messages"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'FirstImpression' | 'OneCoolThing' | 'Outfit' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    const nonComponentRenders = payloads
        .filter(({ ephemeraId }) => (isEphemeraMapId(ephemeraId)))
    if (nonComponentRenders.length) {
        const renderOutputs = await render({
            renderList: nonComponentRenders
                .map(({ characterId, ephemeraId }) => ({
                    CharacterId: characterId,
                    EphemeraId: ephemeraId
                }))
        })
        //
        // TODO: Replace deliverRenders with a messageBus handler
        //
        await deliverRenders({
            renderOutputs
        })
    }

    //
    // TODO: Translate other types, above, into directly-handled format like below
    //
    await Promise.all(payloads.map(async ({ characterId, ephemeraId }) => {
        if (!isEphemeraFeatureId(ephemeraId) && !isEphemeraRoomId(ephemeraId) && !isEphemeraCharacterId(ephemeraId)) {
            return
        }
        const [globalAssets, { assets: characterAssets }] = await Promise.all([
            internalCache.Global.get('assets'),
            internalCache.CharacterMeta.get(characterId)
        ])
        if (isEphemeraFeatureId(ephemeraId) || isEphemeraRoomId(ephemeraId)) {
            const appearancesByAsset = await internalCache.ComponentMeta.getAcrossAssets(ephemeraId, unique(globalAssets || [], characterAssets) as string[])

            if (isEphemeraRoomId(ephemeraId)) {
                const RoomId = splitType(ephemeraId)[1]
                const possibleRoomAppearances = [...(globalAssets || []), ...characterAssets]
                    .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[]))
                    .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                const [roomCharacterList, ...renderRoomAppearancesUnfiltered] = (await Promise.all([
                    internalCache.RoomCharacterList.get(RoomId),
                    ...(possibleRoomAppearances.map(async (appearance) => {
                        const conditionsPassList = await Promise.all(appearance.conditions.map(async ({ if: source, dependencies }) => (
                            internalCache.EvaluateCode.get({
                                source,
                                mapping: dependencies.reduce<Record<string, string>>((previous, { EphemeraId, key }) => ({ ...previous, [key]: EphemeraId }), {})
                            })
                        )))
                        const allConditionsPass = conditionsPassList.reduce<boolean>((previous, value) => (previous && Boolean(value)), true)
                        if (allConditionsPass) {
                            return appearance
                        }
                        else {
                            return undefined
                        }
                    }))
                ]))
                const renderRoomAppearances = renderRoomAppearancesUnfiltered.filter((value: EphemeraRoomAppearance | undefined): value is EphemeraRoomAppearance => (Boolean(value)))
                const renderRoom = componentAppearanceReduce(...renderRoomAppearances) as Omit<RoomDescribeData, 'RoomId' | 'Characters'>
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [{ characterId }],
                    displayProtocol: 'RoomDescription',
                    RoomId,
                    Characters: roomCharacterList.map(({ EphemeraId, ConnectionIds, ...rest }) => ({ CharacterId: splitType(EphemeraId)[1], ...rest })),
                    ...renderRoom
                })
            }
            if (isEphemeraFeatureId(ephemeraId)) {
                const FeatureId = splitType(ephemeraId)[1]
                const possibleFeatureAppearances = [...(globalAssets || []), ...characterAssets]
                    .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[]))
                    .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                const renderFeatureAppearancesUnfiltered = await Promise.all(possibleFeatureAppearances
                    .map(async (appearance) => {
                        const conditionsPassList = await Promise.all(appearance.conditions.map(async ({ if: source, dependencies }) => (
                            internalCache.EvaluateCode.get({
                                source,
                                mapping: dependencies.reduce<Record<string, string>>((previous, { EphemeraId, key }) => ({ ...previous, [key]: EphemeraId }), {})
                            })
                        )))
                        const allConditionsPass = conditionsPassList.reduce<boolean>((previous, value) => (previous && Boolean(value)), true)
                        if (allConditionsPass) {
                            return appearance
                        }
                        else {
                            return undefined
                        }
                    })
                )
                const renderFeatureAppearances = renderFeatureAppearancesUnfiltered.filter((value: EphemeraRoomAppearance | undefined): value is EphemeraRoomAppearance => (Boolean(value)))
                const renderFeature = componentAppearanceReduce(...renderFeatureAppearances)
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [{ characterId }],
                    displayProtocol: 'FeatureDescription',
                    FeatureId,
                    ...renderFeature
                })
            }
        }

        if (isEphemeraCharacterId(ephemeraId)) {
            const CharacterId = splitType(ephemeraId)[1]
            const characterDescription = (await ephemeraDB.getItem<EphemeraCharacterDescription>({
                EphemeraId: ephemeraId,
                DataCategory: 'Meta::Character',
                ProjectionFields: ['#name', 'Pronouns', 'FirstImpression', 'OneCoolThing', 'Outfit', 'fileURL', 'Color'],
                ExpressionAttributeNames: {
                    '#name': 'Name'
                }
            })) || {
                Name: 'Unknown',
                Pronouns: { subject: 'they', object: 'them', possessive: 'their', adjective: 'theirs', reflexive: 'themself' },
                FirstImpression: ''
            }
            messageBus.send({
                type: 'PublishMessage',
                targets: [{ characterId }],
                displayProtocol: 'CharacterDescription',
                CharacterId,
                ...characterDescription
            })
        }

    }))

    messageBus.send({
        type: 'ReturnValue',
        body: {
            messageType: "ActionComplete"
        }
    })
}

export default perceptionMessage
