import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../../internalCache'
import { getRoomCharacterList } from '../../../../internalCache/hydrateRoomRoster'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { planCharacterMoveTransfer } from './planCharacterMoveTransfer'
import { commitStepSequence } from '../kernel/commitStepSequence'
import { isKernelMutationStep } from '../kernel/kernelStep'
import type { CommitStepSequenceDeps } from '../kernel/commitStepSequence'
import type { RoomCharacterListItem } from '../../../../internalCache/baseClasses'
import type { MembershipApplyArgs, MembershipApplyResult, MembershipDiff } from './types'

export type OrchestrateCharacterRoomMembershipDependencies = {
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

/**
 * Migrate row (character route, BD-36): retired `applyHostEffects` in favor of the general kernel.
 * A thin wrapper (roster snapshots, `CharacterMeta` invalidation, `EphemeraUpdate` publish) around
 * `planCharacterMoveTransfer` (build + compile) and `commitStepSequence` (3e --- this route no
 * longer calls `executeMembershipTransfer` at all; that function now serves only the object-lifecycle
 * admin routes). This route's `entityId` is always a character, so it never needs
 * `repairAdministrativeChainDissolve`'s boundary sweep --- `HostRelationalEdge` is object-only (BD-36's
 * character-relation widening is explicitly deferred), so a character can never be a
 * relational-edge endpoint, and `commitStepSequence`'s `getCurrentHost` (which only resolves a
 * `dissolveRelation` step's referenced hosts) is passed a function that is never actually called.
 *
 * `Character Moved` fact emission is folded into the kernel's own `commitStepSequence`/`factsForStep`
 * (via the `characterNames` dep) rather than layered on top after the kernel call returns --- that's
 * what keeps it streaming before `commitStepSequence`'s own `RoomUpdate` publish loop, mirroring
 * `Object Moved`'s existing ordering guarantee (see `factsForStep.ts`'s doc comment).
 */
export const orchestrateCharacterRoomMembership = async (
    args: MembershipApplyArgs,
    deps: OrchestrateCharacterRoomMembershipDependencies
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

    const planResult = await planCharacterMoveTransfer({
        characterId: args.characterId,
        characterName: characterMeta.Name,
        targetRoomId: args.targetRoomId,
        bundleId: args.bundleId,
        intentKind: args.intentKind,
        intentFromRoomId: args.intentFromRoomId,
        exitName: args.exitName,
        resolveHeaderSlot: args.resolveHeaderSlot,
        getMembershipContainers: async () => priorContainers,
    })

    if (!planResult.changed) {
        return planResult
    }

    const { plan } = planResult

    const result = await commitStepSequence(
        { steps: plan.steps.filter(isKernelMutationStep) },
        {
            messageBus: deps.messageBus,
            streamEvent: deps.streamEvent,
            getCurrentHost: () => undefined,
            transactWrite: deps.transactWrite,
            characterNames: new Map([[args.characterId, characterMeta.Name]]),
        }
    )

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] orchestrateCharacterRoomMembership failed: ${result.errorMessage}`)
        return {
            ok: false,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
        }
    }

    const diff: MembershipDiff<EphemeraRoomId> = { froms: planResult.froms, to: planResult.to, changed: true }

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
        plan,
    }
}
