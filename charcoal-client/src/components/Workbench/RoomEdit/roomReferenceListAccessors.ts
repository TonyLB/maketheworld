import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'
import StandardLudicGraph from '@tonylb/mtw-wml/ts/standardize/components/ludicGraph'
import { SituationProseFacetList } from '@tonylb/mtw-wml/ts/standardize/keys/facets/situationRoom'

import type { ReferenceListSessionAccessor } from '../foundations/ReferenceList/ReferenceListSessionEditor'

type SituationProseFacetListInstance = InstanceType<typeof SituationProseFacetList>

export type SituationFacetSessionAccessor = {
    getFacetList: (room: StandardRoom) => SituationProseFacetListInstance
    setFacetList: (room: StandardRoom, list: SituationProseFacetListInstance) => void
}

export const roomSituationsFacetAccessor: SituationFacetSessionAccessor = {
    getFacetList: (room) => room.situations,
    setFacetList: (room, list) => {
        room._payload._situations = list
    }
}

type RoomReferenceListPayloadHost = {
    _guidance?: ReferenceList
    _ludicGraph?: StandardLudicGraph
}

export const roomGuidanceListAccessor: ReferenceListSessionAccessor<StandardRoom> = {
    getReferenceList: (room) => {
        const payload = room._payload as unknown as RoomReferenceListPayloadHost
        return payload._guidance ?? new ReferenceList([])
    },
    setReferenceList: (room, list) => {
        const payload = room._payload as unknown as RoomReferenceListPayloadHost
        payload._guidance = list
    }
}

// LG-4: `_ludicGraph.nodes` is heterogeneous under alignment (component nodes + presence
// structure nodes), so this accessor filters to Feature-tagged, non-root component nodes on
// read, and on write merges the edit back through `withComponentRefs` rather than replacing the
// whole node list -- a plain replacement would silently drop any Character/Object/root/Presence
// node already on the graph.
export const roomFeaturesListAccessor: ReferenceListSessionAccessor<StandardRoom> = {
    getReferenceList: (room) => {
        const payload = room._payload as unknown as RoomReferenceListPayloadHost
        const rootId = payload._ludicGraph?.rootId
        const componentRefs = payload._ludicGraph?.nodes.componentRefs ?? new ReferenceList([])
        return componentRefs.filter((item) => item.tag === 'Feature' && !(rootId && item.sameKey(rootId)))
    },
    setReferenceList: (room, list) => {
        const payload = room._payload as unknown as RoomReferenceListPayloadHost
        const rootId = payload._ludicGraph?.rootId
        const existingComponentRefs = payload._ludicGraph?.nodes.componentRefs ?? new ReferenceList([])
        const nonFeatureRefs = existingComponentRefs.filter((item) => item.tag !== 'Feature' || Boolean(rootId && item.sameKey(rootId)))
        const mergedComponentRefs = new ReferenceList([...nonFeatureRefs.payload, ...list.payload])
        const graph = payload._ludicGraph ?? new StandardLudicGraph()
        payload._ludicGraph = new StandardLudicGraph({
            ...(graph.toJSON() ?? {}),
            nodes: graph.nodes.withComponentRefs(mergedComponentRefs).toJSON(),
        })
    }
}
