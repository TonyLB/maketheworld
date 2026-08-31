import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import internalCache from '../../../internalCache'
import { getRoomCharacterList } from '../../../internalCache/hydrateRoomRoster'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { executeMembershipTransfer } from '../manipulation/membership/executeObjectMove'
import type { CommitStepSequenceDeps } from '../manipulation/kernel/commitStepSequence'
import type { RoomCharacterListItem } from '../../../internalCache/baseClasses'
import type { MembershipApplyArgs, MembershipApplyResult, MembershipDiff } from './types'

export type ApplyCharacterRoomMembershipDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    getCharacterMeta?: typeof internalCache.CharacterMeta.get;
    transactWrite?: CommitStepSequenceDeps['transactWrite'];
    getSessionId?: () => Promise<string | undefined>;
}

const defaultGetMembershipContainers = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId[]> => {
    const containers = await internalCache.Positions.getMembershipContainers(characterId)
    return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
}

const buildRoomRosterSnapshots = async (
    affectedRooms: EphemeraRoomId[]
): Promise<Partial<Record<EphemeraRoomId, RoomCharacterListItem[]>>> => {
    const entries = await Promise.all(
        affectedRooms.map(async (roomId) => [roomId, await getRoomCharacterList(roomId)] as const)
    )
    return Object.fromEntries(entries) as Partial<Record<EphemeraRoomId, RoomCharacterListItem[]>>
}

const affectedRoomsFromDiff = (froms: EphemeraRoomId[], to: EphemeraRoomId | null): EphemeraRoomId[] =>
    [...new Set([...froms, ...(to ? [to] : [])])]

const membershipDiffFromProjection = (projection: {
    froms: EphemeraRoomId[];
    to: EphemeraRoomId | null;
    changed: boolean;
}): MembershipDiff => ({
    froms: projection.froms,
    to: projection.to,
    changed: projection.changed,
})

/**
 * Migrate row (character route, BD-36): retired `applyHostEffects` in favor of the general kernel.
 * A thin wrapper (roster snapshots, `CharacterMeta` invalidation, `EphemeraUpdate` publish) around
 * `executeMembershipTransfer` (PV1-1b), which also absorbed the object routes'
 * `applyObjectRoomMembership`/`applyObjectClearMembership`. This route's `entityId` is always a
 * character, so `executeMembershipTransfer` never runs its boundary sweep for it --- `HostRelationalEdge`
 * is object-only (BD-36's character-relation widening is explicitly deferred), so a character can
 * never be a relational-edge endpoint. The bare `transferMembership` step is the whole sequence,
 * unless the caller supplies `compileMutationSteps` (Phase 2, navigate) --- see that argument's doc
 * comment.
 *
 * `Character Moved` fact emission is folded into the kernel's own `commitStepSequence`/`factsForStep`
 * (via the `characterNames` dep, threaded through `executeMembershipTransfer`) rather than layered on
 * top after the kernel call returns --- that's what keeps it streaming before `commitStepSequence`'s
 * own `RoomUpdate` publish loop, mirroring `Object Moved`'s existing ordering guarantee (see
 * `factsForStep.ts`'s doc comment).
 */
export const applyCharacterRoomMembership = async (
    args: MembershipApplyArgs,
    deps: ApplyCharacterRoomMembershipDependencies
): Promise<MembershipApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers
    const getCharacterMeta = deps.getCharacterMeta ?? ((characterId) => internalCache.CharacterMeta.get(characterId))

    // Cheap pre-check before any side-effecting fetch (character-meta lookup, kernel commit): a no-op
    // move should cost nothing beyond the containers read every route already pays for.
    const priorContainers = await getMembershipContainers(args.characterId)
    const willChange = priorContainers.some((hostId) => hostId !== args.targetRoomId)
        || (args.targetRoomId !== null && !priorContainers.includes(args.targetRoomId))
    if (!willChange) {
        return {
            ok: true,
            froms: priorContainers.filter((hostId) => hostId !== args.targetRoomId),
            to: args.targetRoomId,
            changed: false,
        }
    }

    const characterMeta = await getCharacterMeta(args.characterId)

    const result = await executeMembershipTransfer({
        entityId: args.characterId,
        target: args.targetRoomId,
        messageBus: deps.messageBus,
        streamEvent: deps.streamEvent,
        getMembershipContainers: async () => priorContainers,
        transactWrite: deps.transactWrite,
        characterNames: new Map([[args.characterId, characterMeta.Name]]),
        ...(args.compileMutationSteps
            ? {
                compileMutationSteps: (generalDiff: { froms: EphemeraMembershipHostId[]; to: EphemeraMembershipHostId | null; changed: boolean }) =>
                    args.compileMutationSteps!({
                        froms: generalDiff.froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id)),
                        to: generalDiff.to !== null && isEphemeraRoomId(generalDiff.to) ? generalDiff.to : null,
                        changed: generalDiff.changed,
                    }),
            }
            : {}),
        ...(args.narrationHandledInline ? { narratedInline: true } : {}),
    })

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] applyCharacterRoomMembership failed: ${result.errorMessage}`)
        return {
            ok: false,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
        }
    }

    const diff = membershipDiffFromProjection({
        froms: result.froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id)),
        to: result.to !== null && isEphemeraRoomId(result.to) ? result.to : null,
        changed: result.changed,
    })

    if (!diff.changed) {
        return { ok: true, ...diff }
    }

    const affectedRooms = affectedRoomsFromDiff(diff.froms, diff.to)
    const roomRosterSnapshots = await buildRoomRosterSnapshots(affectedRooms)
    internalCache.CharacterMeta.invalidate(args.characterId)

    const getSessionId = deps.getSessionId ?? (() => internalCache.Global.get('SessionId'))
    const sessionId = await getSessionId()

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
        beatAnchorTime: result.beatAnchorTime,
        roomRosterSnapshots,
        captures: result.captures,
    }
}
