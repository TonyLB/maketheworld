import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

export type OrphanClassificationInput = {
    objectId: EphemeraObjectId
    hasPairRow: boolean
    hasMetaRow: boolean
    membershipContainers: string[]
    onAnyPositionGraph: boolean
}

/**
 * Orphan iff pair + meta both present, no graph placement on any host,
 * and membership adjacency reverse index is empty.
 */
export const isOrphanedImprovisedObject = (args: OrphanClassificationInput): boolean => {
    if (!args.hasPairRow || !args.hasMetaRow) {
        return false
    }
    if (args.onAnyPositionGraph) {
        return false
    }
    return args.membershipContainers.length === 0
}
