import { Auth } from 'aws-amplify'

import { socketDispatch } from './webSocket.js'

export const SET_NAME = 'SET_NAME'

export const setName = (name) => ({
    type: SET_NAME,
    payload: name
})

export const registerName = () => (dispatch) => {
    return Auth.currentAuthenticatedUser()
        .then(({ username }) => (dispatch(socketDispatch('registername')(username))))
}
