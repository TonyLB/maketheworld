import { getCharactersInPlay } from '../../slices/ephemera'
import { socketDispatch } from '../../slices/lifeLine'

export const lookRoom = (CharacterId) => (props) => (dispatch, getState) => {
    const { RoomId, showNeighborhoods = false, previousAncestry = '' } = props || {}
    const state = getState()
    const currentRoomId = RoomId ? RoomId : getCharactersInPlay(CharacterId)(state).RoomId
    if (currentRoomId) {
        //
        // TODO:  Create a socketAction helper function that abstracts the pattern below
        //
        dispatch(socketDispatch('action')({ actionType: 'look', payload: { CharacterId, PermanentId: `ROOM#${currentRoomId}`} }))

    }
}

export default lookRoom