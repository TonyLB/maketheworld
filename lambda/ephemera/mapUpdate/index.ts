import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import internalCache from "../internalCache"
import { MessageBus, MapUpdateMessage } from "../messageBus/baseClasses"

export const mapUpdateMessage = async ({ payloads, messageBus }: { payloads: MapUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads
        .map(async (payload) => {
            const { characterId, connectionId, previousRoomId, mapId } = payload
            const mapSubscriptions = (await internalCache.Global.get("mapSubscriptions")) || []
            if (characterId) {
                const subscribedConnections = unique(
                    mapSubscriptions
                        .filter(({ characterIds }) => (characterIds.includes(characterId)))
                        .map(({ connectionId }) => (connectionId)),
                    connectionId ? [connectionId] : []
                ) as EphemeraCharacterId[]
                if (!subscribedConnections.length) {
                    return
                }
                const roomId = payload.roomId ?? (await internalCache.CharacterMeta.get(characterId)).RoomId
                if (previousRoomId) {
                    const [previousPossibleMapsFetch, currentPossibleMapsFetch] = await Promise.all([
                        internalCache.CharacterPossibleMaps.get(characterId, previousRoomId),
                        internalCache.CharacterPossibleMaps.get(characterId, roomId)
                    ])
                    const previousPossibleMaps = previousPossibleMapsFetch.mapsPossible
                    const currentPossibleMaps = currentPossibleMapsFetch.mapsPossible
                    const currentMapFetch = await Promise.all(
                        currentPossibleMaps.map(async (mapId) => (
                            internalCache.ComponentRender.get(characterId, mapId)
                        ))
                    )
                    const activeMaps = currentMapFetch
                            .filter(({ rooms }) => (rooms[roomId]))
                    messageBus.send({
                        type: 'EphemeraUpdate',
                        updates: [
                            ...activeMaps
                                .map((mapEntry) => ({
                                    type: 'MapUpdate' as 'MapUpdate',
                                    targets: [characterId],
                                    connectionTargets: subscribedConnections,
                                    active: true as true,
                                    MapId: mapEntry.MapId,
                                    Name: mapEntry.Name,
                                    fileURL: mapEntry.fileURL,
                                    rooms: mapEntry.rooms,
                                    assets: mapEntry.assets
                                })),
                            ...previousPossibleMaps
                                .filter((mapId) => (!(activeMaps.find(({ MapId }) => (MapId === mapId)))))
                                .map((mapId) => ({
                                    type: 'MapUpdate' as 'MapUpdate',
                                    targets: [characterId],
                                    connectionTargets: subscribedConnections,
                                    active: false as false,
                                    MapId: mapId,
                                }))
                        ]
                    })
                }
                else {
                    const currentPossibleMapsFetch = await internalCache.CharacterPossibleMaps.get(characterId, roomId)
                    const currentPossibleMaps = currentPossibleMapsFetch.mapsPossible
                    const currentMapFetch = await Promise.all(
                        currentPossibleMaps.map(async (mapId) => (
                            internalCache.ComponentRender.get(characterId, mapId)
                        ))
                    )
                    const activeMaps = currentMapFetch
                            .filter(({ rooms }) => (rooms[roomId]))
                    messageBus.send({
                        type: 'EphemeraUpdate',
                        updates: [
                            ...activeMaps
                                .map((mapEntry) => ({
                                    type: 'MapUpdate' as 'MapUpdate',
                                    targets: [characterId],
                                    connectionTargets: subscribedConnections,
                                    active: true,
                                    MapId: mapEntry.MapId,
                                    Name: mapEntry.Name,
                                    fileURL: mapEntry.fileURL,
                                    rooms: mapEntry.rooms,
                                    assets: mapEntry.assets
                                })),
                            ...currentMapFetch
                                .filter(({ MapId: check }) => (!(activeMaps.find(({ MapId }) => (MapId === check)))))
                                .map(({ MapId }) => ({
                                    type: 'MapUpdate' as 'MapUpdate',
                                    targets: [characterId],
                                    connectionTargets: subscribedConnections,
                                    active: false as false,
                                    MapId
                                }))
                        ]
                    })
                }
            }
            if (mapId) {
                const allSubscribedCharacterIds = unique(mapSubscriptions.reduce<EphemeraCharacterId[]>((previous, { characterIds }) => ([ ...previous, ...characterIds]), [])) as EphemeraCharacterId[]
                const subscribedConnections = mapSubscriptions.map(({ connectionId }) => (`CONNECTION#${connectionId}` as const))
                await Promise.all(
                    allSubscribedCharacterIds
                        .map(async (characterId) => {
                            const possibleMaps = (await internalCache.CharacterPossibleMaps.get(characterId)).mapsPossible
                            if (possibleMaps.includes(mapId)) {
                                const [mapDescribe, { RoomId }] = await Promise.all([
                                    internalCache.ComponentRender.get(characterId, mapId),
                                    internalCache.CharacterMeta.get(characterId)
                                ])
                                if (mapDescribe.rooms.find(({ roomId }) => (RoomId === roomId))) {
                                    messageBus.send({
                                        type: 'EphemeraUpdate',
                                        updates: [{
                                            type: 'MapUpdate',
                                            targets: [characterId],
                                            connectionTargets: subscribedConnections,
                                            active: true,
                                            ...mapDescribe
                                        }]
                                    })
                                }
                                else {
                                    messageBus.send({
                                        type: 'EphemeraUpdate',
                                        updates: [{
                                            type: 'MapUpdate',
                                            targets: [characterId],
                                            connectionTargets: subscribedConnections,
                                            active: false,
                                            MapId: mapId
                                        }]
                                    })
                                }
                            }
                        })
                )
            }
        })
    )
}

export default mapUpdateMessage
