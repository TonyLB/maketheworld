import { getCurrentRoomId } from '../../selectors/activeCharacter'
import { socketDispatch } from '../communicationsLayer/lifeLine'

export const lookRoom = (CharacterId) => (props) => (dispatch, getState) => {
    const { RoomId, showNeighborhoods = false, previousAncestry = '' } = props || {}
    const state = getState()
    const currentRoomId = RoomId ? RoomId : getCurrentRoomId(CharacterId)(state)
    if (currentRoomId) {
        //
        // TODO:  Create a socketAction helper function that abstracts the pattern below
        //
        dispatch(socketDispatch('action')({ actionType: 'look', payload: { CharacterId, PermanentId: `ROOM#${currentRoomId}`} }))

    }
}

export default lookRoom