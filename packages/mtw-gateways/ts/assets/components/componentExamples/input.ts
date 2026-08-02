import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    AggregateInputError,
    normalizeMergeParticipationOrder,
    type MergeParticipationOrder,
} from '../aggregate/input'

export type AssembleComponentExamplesOptions = {
    /** Default true for ROOM#; false for Feature/Knowledge until needed (A4). */
    resolveRoomLensMarkDefaults?: boolean;
}

export type AssembleComponentExamplesInput = {
    hostUniversalKey: EphemeraId;
    mergeParticipationOrder: MergeParticipationOrder;
    options?: AssembleComponentExamplesOptions;
}

export function isCacheHostEphemeraId(value: string): value is EphemeraId {
    return (
        isEphemeraRoomId(value) ||
        isEphemeraFeatureId(value) ||
        isEphemeraKnowledgeId(value) ||
        isEphemeraObjectId(value) ||
        isEphemeraCharacterId(value)
    )
}

export function validateAssembleComponentExamplesInput(
    input: AssembleComponentExamplesInput
): AssembleComponentExamplesInput & { mergeParticipationOrder: MergeParticipationOrder } {
    if (!isCacheHostEphemeraId(input.hostUniversalKey)) {
        throw new AggregateInputError(
            `hostUniversalKey must be ROOM#, FEATURE#, KNOWLEDGE#, OBJECT#, or CHARACTER#: ${String(input.hostUniversalKey)}`
        )
    }
    const mergeParticipationOrder = normalizeMergeParticipationOrder(input.mergeParticipationOrder)
    return {
        ...input,
        mergeParticipationOrder,
    }
}

export function defaultResolveRoomLensMarkDefaults(hostUniversalKey: EphemeraId): boolean {
    return isEphemeraRoomId(hostUniversalKey)
}
