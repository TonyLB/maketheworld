import { socketDispatch } from '../webSocket.js'
import lookRoom from './lookRoom'

export const parseCommand = (entry) => (dispatch, getState) => {
    console.log(`Command: ${entry}`)
    if (entry === 'l' || entry === 'look') {
        dispatch(lookRoom())
    }
    dispatch(socketDispatch('sendmessage')(entry))
}