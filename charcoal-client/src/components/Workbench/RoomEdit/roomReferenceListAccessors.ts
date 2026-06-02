import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import { ReferenceList } from '@tonylb/mtw-wml/ts/standardize/keys/referenceList'

import type { ReferenceListSessionAccessor } from '../foundations/ReferenceList/ReferenceListSessionEditor'

type RoomReferenceListPayloadHost = {
    _guidance?: ReferenceList
    _features?: ReferenceList
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
        return payload._features ?? new ReferenceList([])
    },
    setReferenceList: (room, list) => {
        const payload = room._payload as unknown as RoomReferenceListPayloadHost
        payload._features = list
    }
}
