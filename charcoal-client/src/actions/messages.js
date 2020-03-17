export const RECEIVE_MESSAGE = 'RECEIVE_MESSAGE'

export const receiveMessage = (message) => ({
    type: RECEIVE_MESSAGE,
    payload: message
})
