import { moveRoomSubscription } from './subscriptions'

export const CONNECTION_REGISTER = 'CONNECTION_REGISTER'

export const connectionRegister = ({ connectionId, characterId, roomId }) => (dispatch) => {
    dispatch(moveRoomSubscription(roomId))
    dispatch({
        type: CONNECTION_REGISTER,
        payload: {
            connectionId,
            characterId,
            roomId
        }
    })
}