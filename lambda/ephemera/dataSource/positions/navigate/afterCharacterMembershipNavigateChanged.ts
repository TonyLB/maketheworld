import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import type { CharacterMetaItem } from '../../../internalCache/characterMeta'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { persistRoomStackNavigate } from '../membership/persistRoomStackNavigate'
import type { MembershipApplySuccessResult, MembershipApplyResult } from '../membership/types'
import { orchestrateCharacterNavigate } from './orchestrateNavigate'

export type AfterCharacterMembershipNavigateChangedArgs = {
    characterId: EphemeraCharacterId;
    characterMeta: CharacterMetaItem;
    result: MembershipApplyResult;
    /** messageOrchestration bundle correlation id; when omitted (connect/disconnect callers), orchestrateCharacterNavigate mints its own. */
    bundleId?: string;
    messageBus: MessageBus;
    getRoomAssets?: (roomId: EphemeraRoomId) => Promise<string[] | undefined>;
    getCanonAssets?: () => Promise<string[] | undefined>;
}

type NavigateTailResult = MembershipApplySuccessResult & {
    changed: true;
    to: EphemeraRoomId;
    beatAnchorTime: number;
}

const shouldRunNavigateTail = (
    result: MembershipApplyResult
): result is NavigateTailResult =>
    result.ok
    && result.changed
    && result.to !== null
    && result.beatAnchorTime !== undefined

/**
 * Parallel navigate tail (RS-2): ladder persist + presentation orchestration after
 * successful graph persist when membership endpoint changed to a non-null room.
 */
export const afterCharacterMembershipNavigateChanged = async ({
    characterId,
    characterMeta,
    result,
    bundleId,
    messageBus,
    getRoomAssets,
    getCanonAssets,
}: AfterCharacterMembershipNavigateChangedArgs): Promise<void> => {
    if (!shouldRunNavigateTail(result)) {
        return
    }

    const to = result.to
    const getRoomAssetsFn = getRoomAssets ?? ((roomId) => internalCache.RoomAssets.get(roomId))
    const getCanonAssetsFn = getCanonAssets ?? (() => internalCache.Global.get('assets'))

    const [roomAssets = [], canonAssets = []] = await Promise.all([
        getRoomAssetsFn(to),
        getCanonAssetsFn(),
    ])

    await Promise.all([
        persistRoomStackNavigate({
            characterId,
            targetRoomId: to,
            beatAnchorTime: result.beatAnchorTime,
            characterAssets: characterMeta.assets || [],
            roomAssets,
            canonAssets,
        }).catch((error) => {
            const message = error instanceof Error ? error.message : String(error)
            console.error(`[mtw.ephemera.positions] persistRoomStackNavigate failed: ${message}`)
        }),
        orchestrateCharacterNavigate({
            characterId,
            characterMeta,
            froms: result.froms,
            to,
            beatAnchorTime: result.beatAnchorTime,
            bundleId,
            messageBus,
        }),
    ])
}
