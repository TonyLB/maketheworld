import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { projectRoomGraphFromRosterEntries } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import internalCache from '../../../internalCache'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import {
    applyCharacterMembershipFlat,
    type ApplyCharacterMembershipFlatDependencies,
} from './applyCharacterMembershipFlat'
import { buildCharacterMovedFact } from './buildCharacterMovedFact'
import { streamMembershipFact } from './streamMembershipFact'
import type { ActiveCharacterRosterEntry, MembershipApplyArgs, MembershipApplyResult } from './types'

export type ApplyCharacterRoomMembershipDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    flatPersist?: ApplyCharacterMembershipFlatDependencies;
    getSessionId?: () => Promise<string | undefined>;
}

const memoRoomRosterCaches = (
    roomRosterSnapshots: Partial<Record<EphemeraRoomId, ActiveCharacterRosterEntry[]>> | undefined,
    endpoints: Array<EphemeraRoomId | null>
): void => {
    for (const roomId of endpoints) {
        if (!roomId) {
            continue
        }
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.invalidate(roomId)
        const roster = roomRosterSnapshots?.[roomId]
        if (roster) {
            internalCache.Positions.set({
                componentId: roomId,
                graph: projectRoomGraphFromRosterEntries(
                    roster.map((entry) => ({
                        EphemeraId: entry.EphemeraId,
                        DisplayName: entry.DisplayName ?? '',
                        SessionIds: entry.SessionIds ?? [],
                        ...(entry.Color !== undefined ? { Color: entry.Color } : {}),
                        ...(entry.fileURL !== undefined ? { fileURL: entry.fileURL } : {}),
                    }))
                ),
            })
        }
    }
}

export const applyCharacterRoomMembership = async (
    args: MembershipApplyArgs,
    deps: ApplyCharacterRoomMembershipDependencies
): Promise<MembershipApplyResult> => {
    const result = await applyCharacterMembershipFlat(args, deps.flatPersist)

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] applyCharacterMembershipFlat failed: ${result.errorMessage}`)
        return result
    }

    if (!result.changed) {
        return result
    }

    const beatAnchorTime = getCurrentTimestamp()
    const getSessionId = deps.getSessionId ?? (() => internalCache.Global.get('SessionId'))
    const sessionId = await getSessionId()
    const characterMeta = await internalCache.CharacterMeta.get(args.characterId)

    const fact = buildCharacterMovedFact({
        characterId: args.characterId,
        applyResult: {
            from: result.from,
            to: result.to,
            beatAnchorTime,
        },
        characterName: characterMeta.Name,
    })
    if (fact) {
        await streamMembershipFact(fact, { streamEvent: deps.streamEvent })
    }

    memoRoomRosterCaches(result.roomRosterSnapshots, [result.from, result.to])
    internalCache.CharacterMeta.invalidate(args.characterId)

    for (const roomId of [result.from, result.to]) {
        if (roomId) {
            deps.messageBus.publish({
                type: 'RoomUpdate',
                roomId,
            })
        }
    }

    deps.messageBus.publish({
        type: 'EphemeraUpdate',
        updates: [{
            type: 'CharacterInPlay',
            CharacterId: characterMeta.EphemeraId,
            Connected: true,
            RoomId: result.to ?? characterMeta.HomeId,
            connectionTargets: ['GLOBAL', `SESSION#${sessionId}`],
        }],
    })

    return {
        ...result,
        beatAnchorTime,
    }
}
