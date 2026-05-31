import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    AggregateInputError,
    normalizeMergeParticipationOrder,
    type MergeParticipationOrder,
} from '../aggregate/input'

export type AssembleRoomTopologyInput = {
    roomUniversalKey: EphemeraId;
    mergeParticipationOrder: MergeParticipationOrder;
}

export function validateAssembleRoomTopologyInput(
    input: AssembleRoomTopologyInput
): AssembleRoomTopologyInput & { mergeParticipationOrder: MergeParticipationOrder } {
    if (!isEphemeraRoomId(input.roomUniversalKey)) {
        throw new AggregateInputError(
            `roomUniversalKey must be ROOM#: ${String(input.roomUniversalKey)}`
        )
    }
    const mergeParticipationOrder = normalizeMergeParticipationOrder(input.mergeParticipationOrder)
    return {
        ...input,
        mergeParticipationOrder,
    }
}
