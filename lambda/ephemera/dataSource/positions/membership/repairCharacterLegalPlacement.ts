import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../internalCache'
import { executeCharacterNavigate } from '../../../moveCharacter/executeCharacterNavigate'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import {
    trimPersistCharacterRoomStack,
    type TrimPersistCharacterRoomStackDependencies,
} from './trimPersistCharacterRoomStack'

export type RepairCharacterLegalPlacementArgs = {
    characterId: EphemeraCharacterId;
    forceMove?: boolean;
    forceRender?: boolean;
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    trimPersist?: TrimPersistCharacterRoomStackDependencies;
}

export type RepairCharacterLegalPlacementResult = {
    trimmed: boolean;
    relocated: boolean;
}

/**
 * Legal placement on asset visibility loss: trim ladder, compare resolved room to
 * authoritative membership, apply membership when in play and endpoint differs.
 */
export const repairCharacterLegalPlacement = async ({
    characterId,
    forceMove = false,
    forceRender = false,
    messageBus,
    streamEvent,
    trimPersist,
}: RepairCharacterLegalPlacementArgs): Promise<RepairCharacterLegalPlacementResult> => {
    const characterMeta = await internalCache.CharacterMeta.get(characterId)
    const canonAssets = await internalCache.Global.get('assets') ?? []
    const accessibleAssets = [...canonAssets, ...characterMeta.assets]

    if (!forceMove && characterMeta.RoomStack.every(({ asset }) => accessibleAssets.includes(asset))) {
        return { trimmed: false, relocated: false }
    }

    const {
        targetRoomId,
        trimmedRoomStack,
        ladderChanged,
    } = await trimPersistCharacterRoomStack(characterId, trimPersist)

    const containers = await internalCache.Positions.getMembershipContainers(characterId)
    const inPlay = containers.length > 0

    if (!inPlay) {
        return { trimmed: ladderChanged, relocated: false }
    }

    const currentRoom = containers[0]
    const shouldRelocate = forceMove || targetRoomId !== currentRoom

    if (shouldRelocate) {
        const result = await executeCharacterNavigate({
            characterId,
            targetRoomId,
            messageBus,
            streamEvent,
        })
        return { trimmed: ladderChanged, relocated: Boolean(result.ok && result.changed) }
    }

    if (forceRender) {
        messageBus.publish({
            type: 'Perception',
            characterId: characterMeta.EphemeraId,
            ephemeraId: targetRoomId,
        })
    }

    return { trimmed: ladderChanged, relocated: false }
}
