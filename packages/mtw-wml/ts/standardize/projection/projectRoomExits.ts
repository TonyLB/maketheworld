import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'

import StandardArea from '../components/area'
import { StandardLiteral } from '../literal'
import { referenceFromExitEndpoint } from '../keys/edges/endpointReference'
import type { StandardFacetData } from '../keys/facets/dataTypes/facet'
import type { ExitPayload } from '../keys/facets/dataTypes/facet'
import { ExitFacetList, StandardExitFacet } from '../keys/facets/exit'
import StandardReference from '../keys/reference'

const isRoomUniversalKey = (value: string | undefined): value is ComponentUUID =>
    typeof value === 'string' && value.startsWith('ROOM#')

const literalPlainString = (literal?: StandardLiteral): string | undefined => {
    if (!literal) {
        return undefined
    }
    const json = literal.toJSON()
    if (typeof json !== 'string' || json.length === 0) {
        return undefined
    }
    return json
}

const roomPeerReference = (ref: StandardReference | undefined): StandardReference | undefined => {
    if (!ref || !isRoomUniversalKey(ref.universalKey)) {
        return undefined
    }
    return ref
}

const facetFromEdgeRole = (
    peerRef: StandardReference | undefined,
    label: string | undefined
): StandardExitFacet | undefined => {
    if (!peerRef || !label) {
        return undefined
    }
    const facetData: StandardFacetData<ExitPayload> = {
        reference: peerRef.toJSON(),
        payload: label,
    }
    return new StandardExitFacet(facetData)
}

/**
 * Project Area topology edges onto one room's ephemeraWire exit facet list (D16, D17).
 *
 * Caller supplies merged StandardArea instances at mergeParticipationOrder (D15).
 * Pure function: no Dynamo, no InternalCache.
 */
export function projectRoomExits(
    roomUniversalKey: ComponentUUID,
    mergedAreas: readonly StandardArea[]
): ExitFacetList {
    const roomRef = new StandardReference(roomUniversalKey, 'Room')
    const facets: StandardExitFacet[] = []

    for (const area of mergedAreas) {
        for (const edge of area.positionGraph.edges.items) {
            const fromRef = referenceFromExitEndpoint(edge.from)
            const toRef = referenceFromExitEndpoint(edge.to)
            const forwardLabel = literalPlainString(edge.payload.forward)
            const backLabel = literalPlainString(edge.payload.back)

            if (roomRef.sameKey(fromRef)) {
                const facet = facetFromEdgeRole(roomPeerReference(toRef), forwardLabel)
                if (facet) {
                    facets.push(facet)
                }
            }
            if (roomRef.sameKey(toRef)) {
                const facet = facetFromEdgeRole(roomPeerReference(fromRef), backLabel)
                if (facet) {
                    facets.push(facet)
                }
            }
        }
    }

    // ExitFacetList constructor merges same-reference facets (layered asset semantics).
    // Topology projection may emit multiple facets to the same ROOM# (D5, self-loop D16).
    const list = new ExitFacetList([])
    ;(list as ExitFacetList & { _items: StandardExitFacet[] })._items = facets
    return list
}
