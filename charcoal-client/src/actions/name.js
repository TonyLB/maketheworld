import { socketDispatch } from './webSocket.js'

export const SET_NAME = 'SET_NAME'

export const setName = (name) => ({
    type: SET_NAME,
    payload: name
})

export const registerName = ({ name, characterId }) => (dispatch) => {
    dispatch(socketDispatch('registername')({ name, characterId }))
    dispatch(setName(name))
}
