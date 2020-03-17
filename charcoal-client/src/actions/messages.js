export const RECEIVE_MESSAGE = 'RECEIVE_MESSAGE'

export const receiveMessage = (message) => ({
    type: RECEIVE_MESSAGE,
    payload: message
})


export const sendMessage = (message) => (dispatch, getState) => {
    const { webSocket } = getState()
    if (webSocket) {
        webSocket.send(JSON.stringify({
            message: 'sendmessage',
            data: message
        }))
    }
}