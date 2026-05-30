import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import type { PersistedReferencedByEntry } from '../componentData/referencedBy'

import type { MergeParticipationOrder } from './input'

export type MergedComponentResult = {
    readonly universalKey: EphemeraId
    readonly merged: StandardComponent
    readonly mergeParticipationOrderApplied: MergeParticipationOrder
    readonly referencedByUnion?: PersistedReferencedByEntry[]
}

export type MergedComponentResultArgs = {
    universalKey: EphemeraId
    merged: StandardComponent
    mergeParticipationOrderApplied: MergeParticipationOrder
    referencedByUnion?: PersistedReferencedByEntry[]
}

export function mergedComponentResult(args: MergedComponentResultArgs): MergedComponentResult {
    return Object.freeze({
        universalKey: args.universalKey,
        merged: args.merged,
        mergeParticipationOrderApplied: args.mergeParticipationOrderApplied,
        ...(args.referencedByUnion?.length ? { referencedByUnion: args.referencedByUnion } : {}),
    })
}
