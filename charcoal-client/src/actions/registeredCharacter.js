import { socketDispatch } from './webSocket.js'

export const SET_NAME = 'SET_NAME'

export const setName = (name) => ({
    type: SET_NAME,
    payload: name
})

export const registerCharacter = ({ name, characterId }) => (dispatch) => {
    dispatch(socketDispatch('registercharacter')({ name, characterId }))
    dispatch(setName(name))
}
