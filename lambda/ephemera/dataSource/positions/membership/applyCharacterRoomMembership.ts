import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import { getRoomCharacterList } from '../../../internalCache/hydrateRoomRoster'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { planMembershipTransfer } from '../manipulation/adapters/planMembershipTransfer'
import { commitStepSequence } from '../manipulation/kernel/commitStepSequence'
import type { CommitStepSequenceDeps } from '../manipulation/kernel/commitStepSequence'
import type { MutationKernelStep } from '../manipulation/kernel/kernelStep'
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
 * Migrate row (character route, BD-36): retired `applyHostEffects` in favor of the general kernel,
 * matching `applyObjectRoomMembership`/`applyObjectClearMembership`'s sibling migrations. Unlike the
 * object routes, this route builds no `dissolveRelation` steps at all --- `HostRelationalEdge` is
 * object-only (BD-36's character-relation widening is explicitly deferred), so a character can never
 * be a relational-edge endpoint; there is nothing for `boundaryEdgeOutcomes` to sweep here, not just
 * nothing found in practice. The bare `transferMembership` step is the whole sequence.
 *
 * `Character Moved` fact emission is folded into the kernel's own `commitStepSequence`/`factsForStep`
 * (via the `characterNames` dep) rather than layered on top after the kernel call returns --- that's
 * what keeps it streaming before `commitStepSequence`'s own `RoomUpdate` publish loop, mirroring
 * `Object Moved`'s existing ordering guarantee (see `factsForStep.ts`'s doc comment).
 */
export const applyCharacterRoomMembership = async (
    args: MembershipApplyArgs,
    deps: ApplyCharacterRoomMembershipDependencies
): Promise<MembershipApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers
    const getCharacterMeta = deps.getCharacterMeta ?? ((characterId) => internalCache.CharacterMeta.get(characterId))

    const priorContainers = await getMembershipContainers(args.characterId)
    const plan = planMembershipTransfer({
        applyMode: 'end-state',
        target: args.targetRoomId,
        priorContainers,
    })

    const diff = membershipDiffFromProjection({
        froms: plan.projection.froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id)),
        to: plan.projection.to !== null && isEphemeraRoomId(plan.projection.to) ? plan.projection.to : null,
        changed: plan.projection.changed,
    })

    if (!diff.changed) {
        return { ok: true, ...diff }
    }

    const characterMeta = await getCharacterMeta(args.characterId)

    const transferStep: MutationKernelStep = {
        kind: 'transferMembership',
        entityIds: new Set([args.characterId]),
        fromHostIds: new Set(diff.froms),
        toHostId: diff.to,
    }

    const result = await commitStepSequence(
        { steps: [transferStep] },
        {
            messageBus: deps.messageBus,
            streamEvent: deps.streamEvent,
            getCurrentHost: () => undefined,
            transactWrite: deps.transactWrite,
            characterNames: new Map([[args.characterId, characterMeta.Name]]),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] applyCharacterRoomMembership failed: ${result.errorMessage}`)
        return {
            ok: false,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
        }
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
    }
}
