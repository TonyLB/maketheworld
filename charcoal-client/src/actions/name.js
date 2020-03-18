import { socketDispatch } from './webSocket.js'

export const SET_NAME = 'SET_NAME'

export const setName = (name) => ({
    type: SET_NAME,
    payload: name
})

export const registerName = () => (dispatch, getState) => {
    const { name = '' } = getState()
    if (name) {
        dispatch(socketDispatch('registername')(name))
    }
}
