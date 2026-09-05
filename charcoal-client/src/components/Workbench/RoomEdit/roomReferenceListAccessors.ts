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

export const roomFeaturesListAccessor: ReferenceListSessionAccessor<StandardRoom> = {
    getReferenceList: (room) => {
        const payload = room._payload as unknown as RoomReferenceListPayloadHost
        return payload._ludicGraph?.nodes ?? new ReferenceList([])
    },
    setReferenceList: (room, list) => {
        const payload = room._payload as unknown as RoomReferenceListPayloadHost
        payload._ludicGraph = new StandardLudicGraph({
            ...(payload._ludicGraph?.toJSON() ?? {}),
            nodes: list.toJSON(),
        })
    }
}
