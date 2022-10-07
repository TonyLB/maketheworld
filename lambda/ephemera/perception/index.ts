import { PerceptionMessage, MessageBus } from "../messageBus/baseClasses"
import { render } from "@tonylb/mtw-utilities/dist/perception"
import { deliverRenders } from "@tonylb/mtw-utilities/dist/perception/deliverRenders"
import internalCache from "../internalCache"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { EphemeraCharacter, EphemeraCondition, EphemeraExit, EphemeraFeatureAppearance, EphemeraMapAppearance, EphemeraRoomAppearance, EphemeraRoomId, isEphemeraCharacterId, isEphemeraFeatureId, isEphemeraMapId, isEphemeraRoomId } from "../cacheAsset/baseClasses"
import { componentAppearanceReduce } from "./components"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { RoomDescribeData } from "@tonylb/mtw-interfaces/dist/messages"
import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

type EphemeraCharacterDescription = {
    [K in 'Name' | 'Pronouns' | 'FirstImpression' | 'OneCoolThing' | 'Outfit' | 'fileURL' | 'Color']: EphemeraCharacter[K];
}

const filterAppearances = async <T extends { conditions: EphemeraCondition[] }>(possibleAppearances: T[]): Promise<T[]> => {
    const allPromises = possibleAppearances
        .map(async (appearance): Promise<T | undefined> => {
            const conditionsPassList = await Promise.all(appearance.conditions.map(({ if: source, dependencies }) => (
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
    const allMappedAppearances = await Promise.all(allPromises) as (T | undefined)[]
    return allMappedAppearances.filter((value: T | undefined): value is T => (Boolean(value)))
}

export const perceptionMessage = async ({ payloads, messageBus }: { payloads: PerceptionMessage[], messageBus: MessageBus }): Promise<void> => {
    // const nonComponentRenders = payloads
    //     .filter(({ ephemeraId }) => (isEphemeraMapId(ephemeraId)))
    // if (nonComponentRenders.length) {
    //     const renderOutputs = await render({
    //         renderList: nonComponentRenders
    //             .map(({ characterId, ephemeraId }) => ({
    //                 CharacterId: characterId,
    //                 EphemeraId: ephemeraId
    //             }))
    //     })
    //     //
    //     // TODO: Replace deliverRenders with a messageBus handler
    //     //
    //     await deliverRenders({
    //         renderOutputs
    //     })
    // }

    //
    // TODO: Translate other types, above, into directly-handled format like below
    //
    await Promise.all(payloads.map(async ({ characterId, ephemeraId }) => {
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
        else {
            const [globalAssets, { assets: characterAssets }] = await Promise.all([
                internalCache.Global.get('assets'),
                internalCache.CharacterMeta.get(characterId)
            ])
            const appearancesByAsset = await internalCache.ComponentMeta.getAcrossAssets(ephemeraId, unique(globalAssets || [], characterAssets) as string[])

            if (isEphemeraRoomId(ephemeraId)) {
                const RoomId = splitType(ephemeraId)[1]
                const possibleRoomAppearances = [...(globalAssets || []), ...characterAssets]
                    .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[]))
                    .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                const [roomCharacterList, renderRoomAppearances] = (await Promise.all([
                    internalCache.RoomCharacterList.get(RoomId),
                    filterAppearances(possibleRoomAppearances)
                ]))
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
                    .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraFeatureAppearance[]))
                    .reduce<EphemeraFeatureAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                const renderFeatureAppearances = await filterAppearances(possibleFeatureAppearances)
                const renderFeature = componentAppearanceReduce(...renderFeatureAppearances)
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [{ characterId }],
                    displayProtocol: 'FeatureDescription',
                    FeatureId,
                    ...renderFeature
                })
            }
            if (isEphemeraMapId(ephemeraId)) {
                const possibleMapAppearances = [...(globalAssets || []), ...characterAssets]
                    .map((assetId) => ((appearancesByAsset[assetId]?.appearances || []) as EphemeraMapAppearance[]))
                    .reduce<EphemeraMapAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                const renderMapAppearances = await filterAppearances(possibleMapAppearances)
                const allRooms = (unique(...renderMapAppearances.map(({ rooms }) => (Object.values(rooms).map(({ EphemeraId }) => (EphemeraId))))) as string[])
                    .filter(isEphemeraRoomId)
                const roomPositions = renderMapAppearances
                    .map(({ rooms }) => (rooms))
                    .reduce<Record<EphemeraRoomId, { x: number; y: number }>>((previous, rooms) => (
                        Object.values(rooms).reduce((accumulator, room) => ({ ...accumulator, [room.EphemeraId]: { x: room.x, y: room.y } }), previous)
                    ), {})
                const roomMetas = await Promise.all(allRooms.map(async (ephemeraId) => {
                    const metaByAsset = await internalCache.ComponentMeta.getAcrossAssets(ephemeraId, unique(globalAssets || [], characterAssets) as string[])
                    const possibleRoomAppearances = [...(globalAssets || []), ...characterAssets]
                        .map((assetId) => (((metaByAsset[assetId]?.appearances || []) as EphemeraRoomAppearance[])
                            .filter(({ name, exits }) => (name || exits.find(({ to }) => (isEphemeraRoomId(to) &&  allRooms.includes(to)))))
                        ))
                        .reduce<EphemeraRoomAppearance[]>((previous, appearances) => ([ ...previous, ...appearances ]), [])
                    const aggregateRoomDescription = {
                        roomId: splitType(ephemeraId)[1],
                        name: possibleRoomAppearances.map(({ name }) => (name)).join(''),
                        x: roomPositions[ephemeraId].x,
                        y: roomPositions[ephemeraId].y,
                        exits: Object.values(possibleRoomAppearances
                            .map(({ exits }) => (exits.filter(({ to }) => (isEphemeraRoomId(to) && allRooms.includes(to)))))
                            .reduce<Record<string, EphemeraExit>>((previous, exits) => (
                                exits.reduce<Record<string, EphemeraExit>>((accumulator, exit) => ({
                                    ...accumulator,
                                    [exit.to]: exit
                                }), previous)
                            ), {}))
                    }
                    return aggregateRoomDescription
                }))

                messageBus.send({
                    type: `EphemeraUpdate`,
                    global: false,
                    updates: [{
                        type: 'MapUpdate',
                        targets: [{ characterId }],
                        MapId: splitType(ephemeraId)[1],
                        Name: renderMapAppearances.map(({ name }) => (name)).join(''),
                        fileURL: renderMapAppearances
                            .map(({ fileURL }) => (fileURL))
                            .filter((value) => (value))
                            .reduce((previous, value) => (value || previous), ''),
                        rooms: roomMetas
                    }]
                })
            }
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
