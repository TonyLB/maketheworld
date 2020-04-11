import { moveRoomSubscription } from './subscriptions'
import { fetchCurrentRoom } from './currentRoom'
import { fetchCharactersInPlay } from './characters'
import { lookRoom } from './behaviors/lookRoom'

export const CONNECTION_REGISTER = 'CONNECTION_REGISTER'

export const connectionRegister = ({ connectionId, characterId }) => (dispatch, getState) => {
    dispatch({
        type: CONNECTION_REGISTER,
        payload: {
            connectionId,
            characterId
        }
    })
    dispatch(fetchCharactersInPlay())
        .then(() => (dispatch(moveRoomSubscription())))
        .then(() => (dispatch(fetchCurrentRoom())))
        .then(() => (dispatch(lookRoom())))
}