export const REGISTER_WEB_SOCKET = 'REGISTER_WEB_SOCKET'

export const registerWebSocket = (webSocket) => {
    return {
        type: REGISTER_WEB_SOCKET,
        payload: {
            webSocket
        }
    }
}

//
// socketDispatch
//
// A function factory that turns out dispatch Thunk functions when passed a message type.
// The thunk functions take a payload, and then send that payload in that type of message
// wrapper to the open webSocket.
//
// TODO:  The internal function needs to throw errors if there is no webSocket, or if the
// webSocket has closed or timed out.
//
export const socketDispatch = (messageType) => (payload) => (dispatch, getState) => {
    const { webSocket } = getState()
    if (webSocket) {
        webSocket.send(JSON.stringify({
            message: messageType,
            data: payload
        }))
    }
}