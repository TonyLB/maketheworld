import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { normalizeExitName } from '../../roomExitTargetsForCharacter'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'

export const objectManipulationErrorMessages = {
    noCatalog: 'ObjectManipulation resolution failed: no in-room object catalog',
    noMatch: 'ObjectManipulation resolution failed: no such object in the room',
    ambiguousMatch: 'ObjectManipulation resolution failed: ambiguous object',
    complexRelational: 'ObjectManipulation enrich: relational placement is not implemented yet',
    nestingRelational: 'ObjectManipulation enrich: putting something inside another object is not supported yet',
    noHostRoom: 'ObjectManipulation resolution failed: you are not in a room',
    notOnHostGraph: 'ObjectManipulation resolution failed: object is not in the room',
    dissolveNoMatchingEdge: 'ObjectManipulation enrich: no matching relation to remove',
    sameSubjectAndTarget: 'ObjectManipulation resolution failed: subject and target must be different objects',
    complexMultiObject: 'ObjectManipulation enrich: multi-object manipulation is not implemented yet',
    complexMultiPresent: 'ObjectManipulation enrich: object is present in more than one place',
    complexUnimplementedVerb: 'ObjectManipulation enrich: that manipulation verb is not implemented yet',
    noMembershipHost: 'ObjectManipulation resolution failed: object has no membership host',
    notCarryingObject: 'ObjectManipulation resolution failed: object is in room but not held',
    alreadyHoldingObject: 'ObjectManipulation resolution failed: object is already held',
    unimplementedAtomicOperation: 'ObjectManipulation enrich: that atomic operation is not implemented yet',
    incompleteTransferSet: 'ObjectManipulation enrich: transfer candidate is missing an object carried by relational topology',
    multiObjectTransferNotYetSupported: 'ObjectManipulation enrich: carrying multiple objects together in one transfer is not supported yet',
    transferInteractionDefer: 'ObjectManipulation enrich: existing relational topology requires interaction assessment before this transfer',
    enrichInvokeFailed: 'Object manipulation enrich failed',
    enrichParseFailed: 'Object manipulation enrich response was not valid',
    identityInvokeFailed: 'Object manipulation identity failed',
    identityParseFailed: 'Object manipulation identity response was not valid',
    frameExtractInvokeFailed: 'Object manipulation frame extract failed',
    frameExtractParseFailed: 'Object manipulation frame extract response was not valid',
} as const

export type ObjectSpanResolutionResult =
    | { type: 'Resolved'; objectId: EphemeraObjectId }
    | { type: 'NoCatalog' }
    | { type: 'NoMatch' }
    | { type: 'AmbiguousMatch' }

export function resolveObjectSpanToObjectId(
    rawObjectSpan: string,
    catalog: readonly RoomInPlayObjectCatalogEntry[] | undefined
): ObjectSpanResolutionResult {
    if (!catalog || catalog.length === 0) {
        return { type: 'NoCatalog' }
    }
    const normalizedCandidate = normalizeExitName(rawObjectSpan)
    if (!normalizedCandidate) {
        return { type: 'NoMatch' }
    }
    const matchingObjectIds = [
        ...new Set(
            catalog
                .filter(({ normalizedShortName }) => normalizedShortName === normalizedCandidate)
                .map(({ objectId }) => objectId)
        ),
    ]
    if (matchingObjectIds.length === 0) {
        return { type: 'NoMatch' }
    }
    if (matchingObjectIds.length > 1) {
        return { type: 'AmbiguousMatch' }
    }
    return { type: 'Resolved', objectId: matchingObjectIds[0] }
}

export function objectManipulationErrorMessageForResolution(
    resolution: Exclude<ObjectSpanResolutionResult, { type: 'Resolved' }>
): string {
    switch (resolution.type) {
        case 'NoCatalog':
            return objectManipulationErrorMessages.noCatalog
        case 'NoMatch':
            return objectManipulationErrorMessages.noMatch
        case 'AmbiguousMatch':
            return objectManipulationErrorMessages.ambiguousMatch
    }
}
