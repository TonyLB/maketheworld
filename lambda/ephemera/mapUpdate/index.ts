import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { unique } from "@tonylb/mtw-utilities/ts/lists"
import internalCache from "../internalCache"
import { MessageBus, MapUpdateMessage } from "../messageBus/baseClasses"
import StandardMap from "@tonylb/mtw-wml/ts/standardize/components/map"
import { schemaToWML } from "@tonylb/mtw-wml/ts/schema"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"

export const mapUpdateMessage = async ({ payloads, messageBus }: { payloads: MapUpdateMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads
        .map(async (payload) => {
            const { characterId, sessionId, previousRoomId, mapId } = payload
            const mapSubscriptions = (await internalCache.Global.get("mapSubscriptions")) || []
            if (characterId) {
                const subscribedConnections = unique(
                    mapSubscriptions
                        .filter(({ characterIds }) => (characterIds.includes(characterId)))
                        .map(({ sessionId }) => (sessionId)),
                    sessionId ? [`SESSION#${sessionId}`] : []
                ) as `SESSION#${string}`[]
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
                    const activeMapsById = currentMapFetch
                        .filter((map) => (Boolean(map.byUniversalId[roomId])))
                        .map((mapForm) => {
                            const mapComponent = mapForm._components.find((component) => (component instanceof StandardMap)) as StandardMap | undefined
                            return (mapComponent && mapComponent.universalKey) ? [{ mapId: mapComponent.universalKey, component: mapForm }] : []
                        })
                        .flat(1)
                        .reduce((previous, { mapId, component }) => ({
                            ...previous,
                            [mapId]: component
                        }), {} as Record<`MAP#${string}`, StandardMap>)
                    messageBus.send({
                        type: 'EphemeraUpdate',
                        updates: [
                            ...Object.entries(activeMapsById)
                                .map(([mapId, component]) => ({
                                    type: 'MapUpdate' as const,
                                    targets: [characterId],
                                    connectionTargets: subscribedConnections,
                                    active: true as true,
                                    MapId: mapId as `MAP#${string}`,
                                    description: schemaToWML([component.schema])
                                })),
                            ...previousPossibleMaps
                                .filter((mapId) => (!Boolean(activeMapsById[mapId])))
                                .map((mapId) => ({
                                    type: 'MapUpdate' as 'MapUpdate',
                                    targets: [characterId],
                                    connectionTargets: subscribedConnections,
                                    active: false as false,
                                    MapId: mapId as `MAP#${string}`,
                                    description: '<Asset key=(render) />'
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
                    const currentMapsById = currentMapFetch
                        .map((mapForm) => {
                            const mapComponent = mapForm._components.find((component) => (component instanceof StandardMap)) as StandardMap | undefined
                            return (mapComponent && mapComponent.universalKey) ? [{ mapId: mapComponent.universalKey, component: mapForm }] : []
                        })
                        .flat(1)
                        .reduce((previous, { mapId, component }) => ({
                            ...previous,
                            [mapId]: component
                        }), {} as Record<`MAP#${string}`, StandardForm>)
                    messageBus.send({
                        type: 'EphemeraUpdate',
                        updates: [
                            ...Object.entries(currentMapsById)
                                .filter(([_, component]) => (component.byUniversalId[roomId]))
                                .map(([mapId, component]) => ({
                                    type: 'MapUpdate' as const,
                                    targets: [characterId],
                                    connectionTargets: subscribedConnections,
                                    active: true as true,
                                    MapId: mapId as `MAP#${string}`,
                                    description: schemaToWML([component.schema])
                                })),
                            ...Object.entries(currentMapsById)
                                .filter(([_, component]) => (!Boolean(component.byUniversalId[roomId])))
                                .map(([mapId]) => ({
                                    type: 'MapUpdate' as 'MapUpdate',
                                    targets: [characterId],
                                    connectionTargets: subscribedConnections,
                                    active: false as false,
                                    MapId: mapId as `MAP#${string}`,
                                    description: '<Asset key=(render) />'
                                }))
                        ]
                    })
                }
            }
            if (mapId) {
                const allSubscribedCharacterIds = unique(mapSubscriptions.reduce<EphemeraCharacterId[]>((previous, { characterIds }) => ([ ...previous, ...characterIds]), [])) as EphemeraCharacterId[]
                const subscribedConnections = mapSubscriptions.map(({ sessionId }) => (`SESSION#${sessionId}` as const))
                await Promise.all(
                    allSubscribedCharacterIds
                        .map(async (characterId) => {
                            const possibleMaps = (await internalCache.CharacterPossibleMaps.get(characterId)).mapsPossible
                            if (possibleMaps.includes(mapId)) {
                                const [mapDescribe, { RoomId }] = await Promise.all([
                                    internalCache.ComponentRender.get(characterId, mapId),
                                    internalCache.CharacterMeta.get(characterId)
                                ])
                                if (mapDescribe.byUniversalId[RoomId]) {
                                    messageBus.send({
                                        type: 'EphemeraUpdate',
                                        updates: [{
                                            type: 'MapUpdate' as const,
                                            targets: [characterId],
                                            connectionTargets: subscribedConnections,
                                            active: true,
                                            MapId: mapId as `MAP#${string}`,
                                            description: schemaToWML([mapDescribe.schema]),
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
