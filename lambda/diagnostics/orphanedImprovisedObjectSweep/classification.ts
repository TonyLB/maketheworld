import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type OrphanClassificationInput = {
    objectId: EphemeraObjectId
    hasPairRow: boolean
    hasMetaRow: boolean
    membershipContainers: string[]
    onAnyLudicGraph: boolean
}

/**
 * Orphan iff pair + meta both present, no graph placement on any host,
 * and membership adjacency reverse index is empty.
 */
export const isOrphanedImprovisedObject = (args: OrphanClassificationInput): boolean => {
    if (!args.hasPairRow || !args.hasMetaRow) {
        return false
    }
    if (args.onAnyLudicGraph) {
        return false
    }
    return args.membershipContainers.length === 0
}
