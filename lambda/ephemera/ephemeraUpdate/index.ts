import { EphemeraPublishTarget, EphemeraUpdateMessage, isEphemeraCharacterArgument, isPublishTargetCharacter, isPublishTargetConnection, isPublishTargetExcludeCharacter, isPublishTargetExcludeConnection, isPublishTargetSession, MessageBus, PublishTargetConnection, PublishTargetSession } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

import { apiClient } from '../apiClient'
import { EphemeraCharacterId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { objectMap } from "../lib/objects"
import { EphemeraClientMessageEphemeraUpdateCharacterInPlayActive, EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive, EphemeraClientMessageEphemeraUpdateItem } from "@tonylb/mtw-interfaces/ts/ephemera"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

export const ephemeraUpdate = async ({ payloads }: { payloads: EphemeraUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const characterIds = payloads.map(({ updates }) => (updates.map(({ connectionTargets, ...rest }) => (rest)).filter(isEphemeraCharacterArgument).map(({ CharacterId }) => (CharacterId)))).flat(1)
    const [RequestId, mapSubscriptions, ...characterMetaValues] = await Promise.all([
        internalCache.Global.get('RequestId'),
        internalCache.Global.get('mapSubscriptions'),
        ...unique(characterIds).map((characterId) => (internalCache.CharacterMeta.get(characterId)))
    ])

    //
    // For reference later, calculate for each CharacterId that appears in the mapSubscriptions table, which sessions
    // are subscribed to maps on behalf of that CharacterId.  As yet, CharacterId targets in ephemeraUpdate only
    // refer to publishing the targeted subscription of map renders.
    //
    const mapSubscriptionsByCharacterId = (mapSubscriptions || []).reduce<Record<EphemeraCharacterId, PublishTargetConnection[]>>(
        (previous, { sessionId, characterIds }) => (characterIds.reduce<Record<EphemeraCharacterId, PublishTargetConnection[]>>(
            (accumulator, characterId) => ({
                ...accumulator,
                [characterId]: [
                    ...(accumulator[characterId] || []),
                    sessionId
                ]
            }), previous
        )), {}
    )

    const sortTargetsIntoConnections = async (targets: EphemeraPublishTarget[]): Promise<{ connectionId: PublishTargetConnection, characters: EphemeraCharacterId[] }[]> => {
        let returnValue: Record<PublishTargetConnection, EphemeraCharacterId[]> = {}
        if (targets.includes('GLOBAL')) {
            const sessions = (await internalCache.Global.get("sessions")) || []
            const connections = (await internalCache.SessionConnections.get(sessions)) ?? []
            connections.forEach((connectionId) => {
                if (!(connectionId in returnValue)) {
                    returnValue[`CHARACTER#${connectionId}`] = []
                }
            })
        }
        await Promise.all(targets.filter(isPublishTargetSession).map(async (sessionId) => {
            const connections = (await internalCache.SessionConnections.get(sessionId)) ?? []
            connections.forEach((connectionId) => {
                if (!(connectionId in returnValue)) {
                    returnValue[`CHARACTER#${connectionId}`] = []
                }
            })
        }))
        targets.filter(isPublishTargetConnection).forEach((connectionId) => {
            if (!(connectionId in returnValue)) {
                returnValue[connectionId] = []
            }
        })
        //
        // Asynchronously create connectionIdsForCharacter from mapSubscriptionsByCharacterId (which contains sessionIds)
        //
        const connectionIdsPerSession = Object.assign({}, ...(await Promise.all(
            unique(...Object.values(mapSubscriptionsByCharacterId)).map(async (sessionId) => ({ [sessionId]: (await internalCache.SessionConnections.get(sessionId)) || [] }))
        ))) as Record<string, string[]>
        targets.filter(isPublishTargetCharacter).forEach((characterId) => {
            const connectionIdsForCharacter = (mapSubscriptionsByCharacterId[characterId] || []).map((sessionId) => (connectionIdsPerSession[sessionId] ?? [])).flat(1)
            connectionIdsForCharacter.forEach((connectionId) => {
                returnValue[connectionId] = unique(returnValue[connectionId] || [], [characterId]) as EphemeraCharacterId[]
            })
        })
        targets.filter(isPublishTargetExcludeConnection).forEach((excludeConnectionId) => {
            delete returnValue[excludeConnectionId]
        })
        targets.filter(isPublishTargetExcludeCharacter).forEach((excludeCharacterId) => {
            returnValue = objectMap(returnValue, (characterList) => (characterList.filter((characterId) => (characterId !== excludeCharacterId))))
        })
        return Object.entries(returnValue).map(([connectionId, characters]) => ({ connectionId: connectionId as PublishTargetConnection, characters }))
    }

    let updatesByConnectionId: Record<PublishTargetConnection, EphemeraClientMessageEphemeraUpdateItem[]> = {}
    await Promise.all(
        payloads.map((payload) => (
            Promise.all(payload.updates.map(
                async (update) => {
                    const distributeTargets = await sortTargetsIntoConnections(update.connectionTargets)
                    distributeTargets.forEach(({ connectionId, characters }) => {
                        if (update.type === 'CharacterInPlay') {
                            const { connectionTargets, ...rest } = update
                            if (update.Connected) {
                                const characterDefaults = characterMetaValues
                                    .filter((value) => (value))
                                    .find(({ EphemeraId }) => (EphemeraId === update.CharacterId))
                                updatesByConnectionId[connectionId] = [
                                    ...(updatesByConnectionId[connectionId] || []),
                                    {
                                        ...(characterDefaults
                                            ? {
                                                Name: characterDefaults.Name,
                                                RoomId: characterDefaults.RoomId,
                                                fileURL: characterDefaults.fileURL,
                                                Color: characterDefaults.Color
                                            }
                                            : {}),
                                        ...rest
                                    } as EphemeraClientMessageEphemeraUpdateCharacterInPlayActive
                                ]
                            }
                            else {
                                updatesByConnectionId[connectionId] = [
                                    ...(updatesByConnectionId[connectionId] || []),
                                    rest as EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive
                                ]
                            }
                        }
                        if (update.type === 'MapClear') {
                            const { targets, ...rest } = update
                            updatesByConnectionId[connectionId] = [
                                ...(updatesByConnectionId[connectionId] || []),
                                { ...rest, targets: characters }
                            ]                            
                        }
                        if (update.type === 'MapUpdate') {
                            const { connectionTargets, targets, ...rest } = update
                            updatesByConnectionId[connectionId] = [
                                ...(updatesByConnectionId[connectionId] || []),
                                { ...rest, targets: characters }
                            ]                            
                        }
                    })
                }
            ))
        ))
    )
    await Promise.all(
        Object.entries(updatesByConnectionId).map(async ([connectionId, updates]) => {
            await apiClient.send(
                splitType(connectionId)[1],
                {
                    messageType: 'Ephemera',
                    RequestId,
                    updates
                }
            )
        })
    )
}

export default ephemeraUpdate
