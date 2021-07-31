import { socketDispatch } from '../communicationsLayer/lifeLine'

export const moveCharacter = (CharacterId) => ({ ExitName, RoomId }) => (dispatch, getState) => {

    dispatch(socketDispatch('action')({ actionType: 'move', payload: { CharacterId, ExitName, RoomId } }))

}

export default moveCharacter