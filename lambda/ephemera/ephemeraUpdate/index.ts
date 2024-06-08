import { EphemeraPublishTarget, EphemeraUpdateMessage, isEphemeraCharacterArgument, isPublishTargetCharacter, isPublishTargetExcludeCharacter, isPublishTargetExcludeSession, isPublishTargetSession, MessageBus, PublishTargetSession } from "../messageBus/baseClasses"

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
    const mapSubscriptionsByCharacterId = (mapSubscriptions || []).reduce<Record<EphemeraCharacterId, PublishTargetSession[]>>(
        (previous, { sessionId, characterIds }) => (characterIds.reduce<Record<EphemeraCharacterId, PublishTargetSession[]>>(
            (accumulator, characterId) => ({
                ...accumulator,
                [characterId]: [
                    ...(accumulator[characterId] || []),
                    sessionId
                ]
            }), previous
        )), {}
    )

    const sortTargetsIntoSessions = async (targets: EphemeraPublishTarget[]): Promise<{ sessionId: PublishTargetSession, characters: EphemeraCharacterId[] }[]> => {
        let returnValue: Record<PublishTargetSession, EphemeraCharacterId[]> = {}
        if (targets.includes('GLOBAL')) {
            const sessions = (await internalCache.Global.get("sessions")) || []
            sessions.forEach((sessionId) => {
                if (!(sessionId in returnValue)) {
                    returnValue[`SESSION#${sessionId}`] = []
                }
            })
        }
        await Promise.all(targets.filter(isPublishTargetSession).map(async (sessionId) => {
            if (!(sessionId in returnValue)) {
                returnValue[`SESSION#${sessionId}`] = []
            }
        }))
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
        targets.filter(isPublishTargetExcludeSession).forEach((excludeSessionId) => {
            delete returnValue[`SESSION#${excludeSessionId}`]
        })
        targets.filter(isPublishTargetExcludeCharacter).forEach((excludeCharacterId) => {
            returnValue = objectMap(returnValue, (characterList) => (characterList.filter((characterId) => (characterId !== excludeCharacterId))))
        })
        return Object.entries(returnValue).map(([sessionId, characters]) => ({ sessionId: sessionId as PublishTargetSession, characters }))
    }

    let updatesBySessionId: Record<PublishTargetSession, EphemeraClientMessageEphemeraUpdateItem[]> = {}
    await Promise.all(
        payloads.map((payload) => (
            Promise.all(payload.updates.map(
                async (update) => {
                    const distributeTargets = await sortTargetsIntoSessions(update.connectionTargets)
                    distributeTargets.forEach(({ sessionId, characters }) => {
                        if (update.type === 'CharacterInPlay') {
                            const { connectionTargets, ...rest } = update
                            if (update.Connected) {
                                const characterDefaults = characterMetaValues
                                    .filter((value) => (value))
                                    .find(({ EphemeraId }) => (EphemeraId === update.CharacterId))
                                updatesBySessionId[sessionId] = [
                                    ...(updatesBySessionId[sessionId] || []),
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
                                updatesBySessionId[sessionId] = [
                                    ...(updatesBySessionId[sessionId] || []),
                                    rest as EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive
                                ]
                            }
                        }
                        if (update.type === 'MapClear') {
                            const { targets, ...rest } = update
                            updatesBySessionId[sessionId] = [
                                ...(updatesBySessionId[sessionId] || []),
                                { ...rest, targets: characters }
                            ]                            
                        }
                        if (update.type === 'MapUpdate') {
                            const { connectionTargets, targets, ...rest } = update
                            updatesBySessionId[sessionId] = [
                                ...(updatesBySessionId[sessionId] || []),
                                { ...rest, targets: characters }
                            ]                            
                        }
                    })
                }
            ))
        ))
    )
    await Promise.all(
        Object.entries(updatesBySessionId).map(async ([sessionId, updates]) => {
            const connectionIds = await internalCache.SessionConnections.get([sessionId])
            await Promise.all(
                (connectionIds ?? []).map(async (connectionId) => {
                    await apiClient.send(
                        connectionId,
                        {
                            messageType: 'Ephemera',
                            RequestId,
                            updates
                        }
                    )
                })
            )
        })
    )
}

export default ephemeraUpdate
