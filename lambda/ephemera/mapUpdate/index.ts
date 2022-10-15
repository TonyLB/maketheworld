import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import internalCache from "../internalCache"
import { MessageBus, MapUpdateMessage } from "../messageBus/baseClasses"

export const mapUpdateMessage = async ({ payloads, messageBus }: { payloads: MapUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads
        .map(async (payload) => {
            const { characterId, connectionId, previousRoomId } = payload
            const mapSubscriptions = (await internalCache.Global.get("mapSubscriptions")) || []
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
                    global: false,
                    updates: [
                        ...activeMaps
                            .map((mapEntry) => ({
                                type: 'MapUpdate' as 'MapUpdate',
                                targets: [characterId],
                                active: true,
                                MapId: mapEntry.MapId,
                                Name: mapEntry.Name,
                                fileURL: mapEntry.fileURL,
                                rooms: mapEntry.rooms
                            })),
                        ...previousPossibleMaps
                            .filter((mapId) => (!(activeMaps.find(({ MapId }) => (MapId === mapId)))))
                            .map((mapId) => ({
                                type: 'MapUpdate' as 'MapUpdate',
                                targets: [characterId],
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
                    global: false,
                    updates: [
                        ...activeMaps
                            .map((mapEntry) => ({
                                type: 'MapUpdate' as 'MapUpdate',
                                targets: [characterId],
                                active: true,
                                MapId: mapEntry.MapId,
                                Name: mapEntry.Name,
                                fileURL: mapEntry.fileURL,
                                rooms: mapEntry.rooms
                            })),
                        ...currentMapFetch
                            .filter(({ MapId: check }) => (!(activeMaps.find(({ MapId }) => (MapId === check)))))
                            .map(({ MapId }) => ({
                                type: 'MapUpdate' as 'MapUpdate',
                                targets: [characterId],
                                active: false as false,
                                MapId
                            }))
                    ]
                })
            }
        })
    )
}

export default mapUpdateMessage
