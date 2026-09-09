import { v4 as uuidv4 } from 'uuid'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import { orchestrateCharacterRoomMembership } from '../manipulation/membership/orchestrateCharacterRoomMembership'
import { persistRoomStackNavigate } from '../manipulation/membership/persistRoomStackNavigate'
import type { PositionsPublishedPayload } from '../publishedEvents'
import type { MembershipApplyResult, IntentKind } from '../manipulation/membership/types'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { MessageOrchestrationSlotSpec } from '../../messageOrchestration/localApiEvents'
import { getCharacterRoomPerspectiveKey } from '../../perception/kickRoomHeaderBroadcast'
import { NAVIGATE_HEADER_SLOT_ID } from './navigateBundleSlotIds'
import { presentCharacterMove } from './presentCharacterMove'

export type OrchestrateCharacterMoveArgs = {
    characterId: EphemeraCharacterId;
    /** null = out of play (disconnect / ghost-purge repair). */
    targetRoomId: EphemeraRoomId | null;
    /** messageOrchestration bundle correlation id; when omitted, a fresh one is minted. */
    bundleId?: string;
    /** Selects leave/arrive copy-kind (`buildCharacterMoveOp.ts`) --- forwarded to `orchestrateCharacterRoomMembership`. */
    intentKind: IntentKind;
    /** The intent's own departure room, used to pick exit-aware copy among possibly several `froms`. */
    intentFromRoomId?: EphemeraRoomId;
    /** Normalized exit label, navigate only --- selects `exitAware` copy. */
    exitName?: string;
    /**
     * Pre-fetched character meta (connect already has it, from `resolveConnectTargetRoom`); when
     * omitted and `targetRoomId` is non-null (navigate/home), fetched here. Never fetched for a
     * null target (disconnect/ghost-purge never read it --- `presentCharacterMove` only reads
     * `characterMeta` inside the header-slot branch, which a null-destination plan never enters).
     */
    characterMeta?: CharacterMetaItem;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getRoomAssets?: (roomId: EphemeraRoomId) => Promise<string[] | undefined>;
    getCanonAssets?: () => Promise<string[] | undefined>;
}

/**
 * The convergence of navigate / home / connect / disconnect (3g, MS-6's correction), plus
 * `repairRoomOccupancyDrift`'s ghost purge and `repairCharacterLegalPlacement`'s relocation call
 * --- six call sites that were the same operation (membership persist, then present) differing only
 * in `intentKind`, whether there's a destination room, and two optional copy fields. Folds the former
 * `executeCharacterNavigate` (navigate/home) and `afterCharacterMembershipNavigateChanged` (the
 * parallel navigate tail) into one function, gated on `targetRoomId !== null` rather than on which
 * caller you are --- the same discriminator `presentCharacterMove` (3f) already gates on one tier down.
 *
 * Builds and compiles the abstract `Move` op exactly once, before commit (3e, MS-2) ---
 * `orchestrateCharacterRoomMembership` forwards `intentKind`/`intentFromRoomId`/`exitName` and this
 * function's `resolveHeaderSlot` into `planCharacterMoveTransfer`, which builds the compiled plan and
 * carries it through commit; `presentCharacterMove` presents that same plan rather than rebuilding it.
 *
 * **Carve-out, stated rather than left to be rediscovered:** when there is a destination room, the
 * eviction-ladder write (`persistRoomStackNavigate`) runs in `Promise.all` *with* presentation, not
 * serially before or after it --- it needs `beatAnchorTime` from the commit result, so it cannot start
 * earlier, and there is no reason to make presentation wait on it. This is why navigate/home/connect
 * do not route through the kernel's generic `commitAndPresentStepSequence` composer even though
 * `orchestrateObjectMove` does: that composer is strictly serial (commit, then present), and cannot
 * express a write running *alongside* presentation. Do not "simplify" this by folding the ladder write
 * into the composer or by serializing it behind narration.
 *
 * `orchestrateObjectMove` is a sibling, not absorbed here --- MS-6's correction: it commits or does not
 * depending on entity kind, which is the disjoint-bodies case ruled out for a shared name.
 *
 * Rules: `dataSource/positions/AGENT.contract.md` --- "Narration and presentation".
 */
export const orchestrateCharacterMove = async ({
    characterId,
    targetRoomId,
    bundleId: suppliedBundleId,
    intentKind,
    intentFromRoomId,
    exitName,
    characterMeta: suppliedCharacterMeta,
    messageBus,
    streamEvent,
    getRoomAssets,
    getCanonAssets,
}: OrchestrateCharacterMoveArgs): Promise<MembershipApplyResult> => {
    const bundleId = suppliedBundleId ?? uuidv4()

    const characterMeta = targetRoomId !== null
        ? (suppliedCharacterMeta ?? await internalCache.CharacterMeta.get(characterId))
        : suppliedCharacterMeta

    const resolveHeaderSlot = targetRoomId !== null
        ? async (to: EphemeraRoomId): Promise<MessageOrchestrationSlotSpec | null> => {
            const perspectiveKey = await getCharacterRoomPerspectiveKey(to, characterMeta?.assets || [])
            return perspectiveKey ? {
                slotId: NAVIGATE_HEADER_SLOT_ID,
                expectedPublishType: 'PerceptionMessage',
                componentId: to,
                perspectiveKey,
                targets: [characterId],
                contentStream: 'render',
                format: 'header',
            } : null
        }
        : undefined

    const result = await orchestrateCharacterRoomMembership(
        { characterId, targetRoomId, bundleId, intentKind, intentFromRoomId, exitName, resolveHeaderSlot },
        { messageBus, streamEvent }
    )

    if (!result.ok || !result.changed) {
        return result
    }

    if (result.to !== null) {
        const to = result.to
        const getRoomAssetsFn = getRoomAssets ?? ((roomId: EphemeraRoomId) => internalCache.RoomAssets.get(roomId))
        const getCanonAssetsFn = getCanonAssets ?? (() => internalCache.Global.get('assets'))

        const [roomAssets = [], canonAssets = []] = await Promise.all([
            getRoomAssetsFn(to),
            getCanonAssetsFn(),
        ])

        await Promise.all([
            persistRoomStackNavigate({
                characterId,
                targetRoomId: to,
                beatAnchorTime: result.beatAnchorTime as number,
                characterAssets: characterMeta?.assets || [],
                roomAssets,
                canonAssets,
            }).catch((error) => {
                const message = error instanceof Error ? error.message : String(error)
                console.error(`[mtw.ephemera.positions] persistRoomStackNavigate failed: ${message}`)
            }),
            presentCharacterMove({
                characterId,
                characterMeta,
                to,
                bundleId,
                plan: result.plan,
                captures: result.captures,
                messageBus,
            }),
        ])
    } else {
        await presentCharacterMove({
            characterId,
            characterMeta,
            to: null,
            bundleId,
            plan: result.plan,
            captures: result.captures,
            messageBus,
        })
    }

    return result
}
