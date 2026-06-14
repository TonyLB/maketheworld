import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { projectRoomGraphFromRosterEntries } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import internalCache from '../../../internalCache'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { buildCharacterMovedFact } from './buildCharacterMovedFact'
import { streamMembershipFact } from './streamMembershipFact'
import type { ActiveCharacterRosterEntry, MembershipApplyArgs, MembershipApplyResult } from './types'
import {
    updatePositionGraphs,
    type UpdatePositionGraphsDependencies,
} from './updatePositionGraphs'

export type ApplyCharacterRoomMembershipDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    graphPersist?: UpdatePositionGraphsDependencies;
    getSessionId?: () => Promise<string | undefined>;
}

const memoRoomRosterCaches = (
    roomRosterSnapshots: Partial<Record<EphemeraRoomId, ActiveCharacterRosterEntry[]>> | undefined,
    affectedRooms: EphemeraRoomId[]
): void => {
    affectedRooms.forEach((roomId) => {
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
    })
}

const affectedRoomsFromDiff = (froms: EphemeraRoomId[], to: EphemeraRoomId | null): EphemeraRoomId[] =>
    [...new Set([...froms, ...(to ? [to] : [])])]

export const applyCharacterRoomMembership = async (
    args: MembershipApplyArgs,
    deps: ApplyCharacterRoomMembershipDependencies
): Promise<MembershipApplyResult> => {
    const result = await updatePositionGraphs(args, deps.graphPersist)

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] updatePositionGraphs failed: ${result.errorMessage}`)
        return result
    }

    const { diff } = result

    if (!diff.changed) {
        return {
            ok: true,
            from: diff.froms[0] ?? null,
            to: diff.to,
            froms: diff.froms,
            changed: false,
        }
    }

    if (!result.persisted) {
        return {
            ok: true,
            from: diff.froms[0] ?? null,
            to: diff.to,
            froms: diff.froms,
            changed: true,
        }
    }

    const beatAnchorTime = getCurrentTimestamp()
    const getSessionId = deps.getSessionId ?? (() => internalCache.Global.get('SessionId'))
    const sessionId = await getSessionId()
    const characterMeta = await internalCache.CharacterMeta.get(args.characterId)

    const fact = buildCharacterMovedFact({
        characterId: args.characterId,
        diff,
        beatAnchorTime,
        characterName: characterMeta.Name,
    })
    if (fact) {
        await streamMembershipFact(fact, { streamEvent: deps.streamEvent })
    }

    const affectedRooms = affectedRoomsFromDiff(diff.froms, diff.to)
    memoRoomRosterCaches(result.roomRosterSnapshots, affectedRooms)
    internalCache.Positions.setMembershipContainers({
        componentId: args.characterId,
        containers: diff.to ? [diff.to] : [],
    })
    internalCache.CharacterMeta.invalidate(args.characterId)

    affectedRooms.forEach((roomId) => {
        deps.messageBus.publish({
            type: 'RoomUpdate',
            roomId,
        })
    })

    deps.messageBus.publish({
        type: 'EphemeraUpdate',
        updates: [{
            type: 'CharacterInPlay',
            CharacterId: characterMeta.EphemeraId,
            Connected: true,
            RoomId: diff.to ?? characterMeta.HomeId,
            connectionTargets: ['GLOBAL', `SESSION#${sessionId}`],
        }],
    })

    return {
        ok: true,
        from: diff.froms[0] ?? null,
        to: diff.to,
        froms: diff.froms,
        changed: true,
        beatAnchorTime,
        roomRosterSnapshots: result.roomRosterSnapshots,
    }
}
