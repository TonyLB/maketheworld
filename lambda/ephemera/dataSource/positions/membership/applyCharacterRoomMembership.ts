import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { projectRoomGraphFromStoredPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../internalCache'
import { getRoomCharacterList } from '../../../internalCache/hydrateRoomRoster'
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

const seedPositionsGraphMemos = (
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>
): void => {
    for (const [roomId, storedGraph] of Object.entries(postApplyRoomGraphs) as [EphemeraRoomId, EphemeraPlayPositionGraph][]) {
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.set({
            componentId: roomId,
            graph: projectRoomGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

const buildRoomRosterSnapshots = async (
    affectedRooms: EphemeraRoomId[]
): Promise<Partial<Record<EphemeraRoomId, ActiveCharacterRosterEntry[]>>> => {
    const roomRosterSnapshots: Partial<Record<EphemeraRoomId, ActiveCharacterRosterEntry[]>> = {}

    for (const roomId of affectedRooms) {
        const roster = await getRoomCharacterList(roomId)
        roomRosterSnapshots[roomId] = roster.map((entry) => ({
            EphemeraId: entry.EphemeraId,
            DisplayName: entry.DisplayName,
            SessionIds: entry.SessionIds,
            ...(entry.Color !== undefined ? { Color: entry.Color } : {}),
            ...(entry.fileURL !== undefined ? { fileURL: entry.fileURL } : {}),
        }))
    }

    return roomRosterSnapshots
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
        return { ok: true, ...diff }
    }

    if (!result.persisted) {
        return { ok: true, ...diff }
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
    seedPositionsGraphMemos(result.postApplyRoomGraphs)
    const roomRosterSnapshots = await buildRoomRosterSnapshots(affectedRooms)
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
        ...diff,
        beatAnchorTime,
        roomRosterSnapshots,
    }
}
