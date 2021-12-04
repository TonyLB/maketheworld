//
// REPLICATE TO ACTIVE-CHARACTER SELECTOR
//
// THEN MARK FOR OBLIVION
//

import { getCurrentRoomId } from './connection'
import { getPermanentHeaders } from './permanentHeaders'

export const getCurrentRoom = (state) => {
    const permanentHeaders = getPermanentHeaders(state)
    const RoomId = getCurrentRoomId(state)
    return (RoomId && permanentHeaders[RoomId]) || {}
}

export const getCurrentNeighborhood = (state) => {
    const currentRoom = getCurrentRoom(state)
    const permanentHeaders = getPermanentHeaders(state)
    if (currentRoom && currentRoom.ParentId) {
        return permanentHeaders[currentRoom.ParentId]
    }
    else {
        return null
    }
}