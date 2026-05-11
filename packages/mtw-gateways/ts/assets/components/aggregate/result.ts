import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import type { MergeParticipationOrder } from './input'

export type MergedComponentResult = {
    readonly universalKey: EphemeraId
    readonly merged: StandardComponent
    readonly mergeParticipationOrderApplied: MergeParticipationOrder
}

export type MergedComponentResultArgs = {
    universalKey: EphemeraId
    merged: StandardComponent
    mergeParticipationOrderApplied: MergeParticipationOrder
}

export function mergedComponentResult(args: MergedComponentResultArgs): MergedComponentResult {
    return Object.freeze({
        universalKey: args.universalKey,
        merged: args.merged,
        mergeParticipationOrderApplied: args.mergeParticipationOrderApplied,
    })
}
