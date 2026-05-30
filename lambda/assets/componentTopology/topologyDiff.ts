import type { ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import StandardArea from '@tonylb/mtw-wml/ts/standardize/components/area'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import { referenceFromExitEndpoint } from '@tonylb/mtw-wml/ts/standardize/keys/edges/endpointReference'

export type TopologyInvalidationDraft =
    | {
          scope: 'room';
          roomIds: ComponentUUID[];
          areaId?: ComponentUUID;
      }
    | {
          scope: 'area';
          areaId: ComponentUUID;
      }

const roomIdFromExitEndpoint = (
    area: StandardArea,
    endpoint: Parameters<typeof referenceFromExitEndpoint>[0]
): ComponentUUID | undefined => {
    const ref = referenceFromExitEndpoint(endpoint)
    if (!ref) {
        return undefined
    }
    const direct = ref.universalKey ?? ref.standardKey.universalKey
    if (direct?.startsWith('ROOM#')) {
        return direct as ComponentUUID
    }
    const nodeMatch = area.positionGraph.nodes.payload.find((node) => node.sameKey(ref))
    const fromNode = nodeMatch?.universalKey
    return fromNode?.startsWith('ROOM#') ? (fromNode as ComponentUUID) : undefined
}

const roomIdsFromArea = (area: StandardArea): ComponentUUID[] => {
    const ids = new Set<ComponentUUID>()
    for (const edge of area.positionGraph?.edges?.items ?? []) {
        const fromKey = roomIdFromExitEndpoint(area, edge.from)
        const toKey = roomIdFromExitEndpoint(area, edge.to)
        if (fromKey) {
            ids.add(fromKey)
        }
        if (toKey) {
            ids.add(toKey)
        }
    }
    return [...ids]
}

export const detectTopologyInvalidations = ({
    component,
    entityRemoved,
}: {
    component: StandardComponent
    entityRemoved: boolean
}): TopologyInvalidationDraft[] => {
    if (component.tag === 'Area' && component instanceof StandardArea) {
        const areaId = component.universalKey as ComponentUUID | undefined
        if (!areaId) {
            return []
        }
        if (entityRemoved) {
            return [{ scope: 'area', areaId }]
        }
        const roomIds = roomIdsFromArea(component)
        if (roomIds.length > 0) {
            return [{ scope: 'room', roomIds, areaId }]
        }
        return [{ scope: 'area', areaId }]
    }

    if (component.tag === 'Room' && component instanceof StandardRoom) {
        const roomId = component.universalKey as ComponentUUID | undefined
        if (!roomId) {
            return []
        }
        const hasExitFacets = (component.exits?.items?.length ?? 0) > 0
        if (!entityRemoved && !hasExitFacets) {
            return []
        }
        return [{ scope: 'room', roomIds: [roomId] }]
    }

    return []
}
