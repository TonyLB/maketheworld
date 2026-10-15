import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { readRoomCharacters } from '../../ludicCache/charactersRow'
import type { MutationKernelStep } from './kernelStep'

/**
 * The pre-commit occupants of every Room a `capture` step names, for `applyStepSequenceCore`'s
 * `initialOccupants`. A room's bystanders are in its characters row, not its graph, and the
 * kernel's reducer cannot read a row mid-transaction, so the caller resolves them first. The read is
 * outside the transaction: it feeds narration audiences only, so a race costs one stale audience.
 */
export const resolveCaptureOccupants = async (
    steps: readonly MutationKernelStep[],
    getRoomCharacters: (roomId: Parameters<typeof readRoomCharacters>[0]) => Promise<EphemeraCharacterId[]> = readRoomCharacters
): Promise<Map<EphemeraMembershipHostId, readonly EphemeraCharacterId[]>> => {
    const roomIds = [...new Set(steps.flatMap((step) => (step.kind === 'capture' && isEphemeraRoomId(step.hostId) ? [step.hostId] : [])))]
    return new Map(await Promise.all(roomIds.map(async (roomId): Promise<[EphemeraMembershipHostId, readonly EphemeraCharacterId[]]> => (
        [roomId, await getRoomCharacters(roomId)]
    ))))
}
