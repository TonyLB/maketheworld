import { EphemeraPublishTarget, EphemeraUpdateMessage, isEphemeraCharacterArgument, isPublishTargetCharacter, isPublishTargetExcludeCharacter, isPublishTargetExcludeSession, isPublishTargetSession, MessageBus, PublishTargetSession } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import type { CharacterMetaItem } from '../internalCache/characterMeta'
import { resolveCharacterRoomId } from '../dataSource/positions/membership/resolveCharacterRoomId'

import { apiClient } from '../apiClient'
import { EphemeraCharacterId, EphemeraRoomId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { unique } from "@tonylb/mtw-utilities/ts/lists"
import { objectMap } from "../lib/objects"
import { EphemeraClientMessageEphemeraUpdateCharacterInPlayActive, EphemeraClientMessageEphemeraUpdateCharacterInPlayInactive, EphemeraClientMessageEphemeraUpdateItem } from "@tonylb/mtw-interfaces/ts/ephemera"

type CharacterInPlayEnrichment = {
    meta?: CharacterMetaItem;
    roomId: EphemeraRoomId;
}

export const ephemeraUpdate = async ({ payloads }: { payloads: EphemeraUpdateMessage[], messageBus?: MessageBus }): Promise<void> => {
    const characterIds = payloads.map(({ updates }) => (updates.map(({ connectionTargets, ...rest }) => (rest)).filter(isEphemeraCharacterArgument).map(({ CharacterId }) => (CharacterId)))).flat(1)
    const uniqueCharacterIds = unique(characterIds)
    const [RequestId, enrichmentRows] = await Promise.all([
        internalCache.Global.get('RequestId'),
        Promise.all(uniqueCharacterIds.map(async (characterId): Promise<[EphemeraCharacterId, CharacterInPlayEnrichment]> => {
            const [meta, roomId] = await Promise.all([
                internalCache.CharacterMeta.get(characterId),
                resolveCharacterRoomId(characterId),
            ])
            return [characterId, { meta, roomId }]
        })),
    ])
    const enrichmentByCharacterId = Object.fromEntries(enrichmentRows) as Record<EphemeraCharacterId, CharacterInPlayEnrichment>

    // PR8 stub window: character-target map fanout is intentionally disabled.
    // See dataSource/maps/AGENT.md. Character-targeted map updates resolve to no sessions here.
    const mapFanoutSessionsByCharacterId: Record<EphemeraCharacterId, PublishTargetSession[]> = {}

    const sortTargetsIntoSessions = async (targets: EphemeraPublishTarget[]): Promise<{ sessionId: PublishTargetSession, characters: EphemeraCharacterId[] }[]> => {
        let returnValue: Record<PublishTargetSession, EphemeraCharacterId[]> = {}
        if (targets.includes('GLOBAL')) {
            const sessions = (await internalCache.Global.get("sessions")) || []
            sessions.forEach((sessionKey) => {
                const sessionId = `SESSION#${sessionKey}`
                if (!(sessionId in returnValue)) {
                    returnValue[sessionId] = []
                }
            })
        }
        await Promise.all(targets.filter(isPublishTargetSession).map(async (sessionId) => {
            if (!(sessionId in returnValue)) {
                returnValue[sessionId] = []
            }
        }))
        targets.filter(isPublishTargetCharacter).forEach((characterId) => {
            const sessionIdsForCharacter = mapFanoutSessionsByCharacterId[characterId] || []
            sessionIdsForCharacter.forEach((sessionId) => {
                returnValue[sessionId] = unique(returnValue[sessionId] || [], [characterId]) as EphemeraCharacterId[]
            })
        })
        targets.filter(isPublishTargetExcludeSession).forEach((excludeSessionId) => {
            delete returnValue[excludeSessionId.slice(1)]
        })
        targets.filter(isPublishTargetExcludeCharacter).forEach((excludeCharacterId) => {
            returnValue = objectMap(returnValue, (characterList) => (characterList.filter((characterId) => (characterId !== excludeCharacterId.slice(1)))))
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
                                const enrichment = enrichmentByCharacterId[update.CharacterId]
                                updatesBySessionId[sessionId] = [
                                    ...(updatesBySessionId[sessionId] || []),
                                    {
                                        ...(enrichment?.meta
                                            ? {
                                                DisplayName: enrichment.meta.Name,
                                                fileURL: enrichment.meta.fileURL,
                                                Color: enrichment.meta.Color,
                                            }
                                            : {}),
                                        ...(enrichment ? { RoomId: enrichment.roomId } : {}),
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
            const connectionIds = await internalCache.SessionConnections.get([sessionId.split('#')[1]])
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
