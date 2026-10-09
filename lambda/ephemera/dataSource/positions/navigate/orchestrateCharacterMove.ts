import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { ActionsPublishedPayload } from '../../actions/publishedEvents'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { MembershipApplyResult, IntentKind } from '../manipulation/membership/types'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { MoveHeaderBinding } from '../manipulation/kernel/compile/positionKernelOp'
import type { CommitStepSequenceDeps } from '../manipulation/kernel/commitStepSequence'
import { commitAndPresentStepSequence } from '../manipulation/kernel/commitAndPresentStepSequence'
import { planCharacterMoveTransfer } from '../manipulation/membership/planCharacterMoveTransfer'
import { getCharacterRoomPerspectiveKey } from '../../perception/kickRoomHeaderBroadcast'

/** A move's compiled plan carries its header as a header-bound `describe` step, which `presentStepSequence` delivers itself, so this dep is structurally unused --- present only because `PresentStepSequenceDeps` requires it. */
const noopActionsStreamEvent: StreamEventFunction<ActionsPublishedPayload> = async () => {}

const defaultGetMembershipContainers = async (characterId: EphemeraCharacterId): Promise<EphemeraRoomId[]> => {
    const containers = await internalCache.Positions.getMembershipContainers(characterId)
    return containers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
}

export type OrchestrateCharacterMoveArgs = {
    characterId: EphemeraCharacterId;
    /** null = out of play (disconnect / ghost-purge repair). */
    targetRoomId: EphemeraRoomId | null;
    /** Selects leave/arrive copy-kind (`buildCharacterMoveOp.ts`) --- forwarded to `planCharacterMoveTransfer`. */
    intentKind: IntentKind;
    /** The intent's own departure room, used to pick exit-aware copy among possibly several `froms`. */
    intentFromRoomId?: EphemeraRoomId;
    /** Normalized exit label, navigate only --- selects `exitAware` copy. */
    exitName?: string;
    /**
     * Pre-fetched character meta (connect already has it, from `resolveConnectTargetRoom`); when
     * omitted and `targetRoomId` is non-null (navigate/home), fetched here. Never fetched for a
     * null target (disconnect/ghost-purge never read it --- only a destination
     * room needs `characterMeta`, for the arrival header's perspective).
     */
    characterMeta?: CharacterMetaItem;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
}

/** Test seams only. */
export type OrchestrateCharacterMoveDependencies = {
    getMembershipContainers?: (characterId: EphemeraCharacterId) => Promise<EphemeraRoomId[]>;
    transactWrite?: CommitStepSequenceDeps['transactWrite'];
}

/**
 * The convergence of navigate / home / connect / disconnect (3g's correction), plus
 * `repairRoomOccupancyDrift`'s ghost purge and `repairCharacterLegalPlacement`'s relocation call
 * --- six call sites that were the same operation differing only in `intentKind`, whether there's a
 * destination room, and two optional copy fields. Gated on `targetRoomId !== null` rather than on
 * which caller you are.
 *
 * Builds and compiles the abstract `Move` op exactly once, before commit (`planCharacterMoveTransfer`,
 * including the header binding), then hands the plan to `commitAndPresentStepSequence`: commit,
 * then present in the compiler's order. Post-commit work (the eviction-ladder write, the
 * `CharacterMeta` invalidate, the `CharacterInPlay` publish) belongs to `Character Moved` subscribers
 * in `mtw.ephemera.characters`, not to this route.
 *
 * A no-op move (unchanged membership) costs only the containers read: nothing else is fetched.
 *
 * The object-move route (`commitAttempt`) is a sibling, not absorbed here --- 3g's correction: it commits or does not
 * depending on entity kind, which is the disjoint-bodies case ruled out for a shared name.
 *
 * Rules: `dataSource/positions/AGENT.contract.md` --- "Narration and presentation".
 */
export const orchestrateCharacterMove = async ({
    characterId,
    targetRoomId,
    intentKind,
    intentFromRoomId,
    exitName,
    characterMeta: suppliedCharacterMeta,
    messageBus,
    streamEvent,
}: OrchestrateCharacterMoveArgs, deps?: OrchestrateCharacterMoveDependencies): Promise<MembershipApplyResult> => {
    const getMembershipContainers = deps?.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(characterId)
    const willChange = priorContainers.some((hostId) => hostId !== targetRoomId)
        || (targetRoomId !== null && !priorContainers.includes(targetRoomId))
    if (!willChange) {
        return {
            ok: true,
            froms: priorContainers.filter((hostId) => hostId !== targetRoomId),
            to: targetRoomId,
            changed: false,
        }
    }

    // Always needed for `characterNames` (the `Character Moved` fact's name) once the move is real.
    const characterMeta = suppliedCharacterMeta ?? await internalCache.CharacterMeta.get(characterId)

    const resolveHeader = targetRoomId !== null
        ? async (to: EphemeraRoomId): Promise<MoveHeaderBinding> => {
            const assets = characterMeta.assets || []
            return { perspectiveKey: await getCharacterRoomPerspectiveKey(to, assets), assets }
        }
        : undefined

    const planResult = await planCharacterMoveTransfer({
        characterId,
        characterName: characterMeta.Name,
        targetRoomId,
        intentKind,
        intentFromRoomId,
        exitName,
        resolveHeader,
        getMembershipContainers: async () => priorContainers,
    })
    if (!planResult.changed) {
        return planResult
    }

    const result = await commitAndPresentStepSequence(planResult.plan, characterId, {
        commit: {
            messageBus,
            streamEvent,
            getCurrentHost: () => undefined,
            transactWrite: deps?.transactWrite,
            characterNames: new Map([[characterId, characterMeta.Name]]),
        },
        perceive: { streamEvent: noopActionsStreamEvent, messageBus },
    })
    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] orchestrateCharacterMove failed: ${result.errorMessage}`)
        return { ok: false, errorCode: result.errorCode, errorMessage: result.errorMessage }
    }

    return { ok: true, froms: planResult.froms, to: planResult.to, changed: true }
}
