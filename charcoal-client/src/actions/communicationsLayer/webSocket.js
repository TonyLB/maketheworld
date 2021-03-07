import { WSS_ADDRESS } from '../../config'
import { disconnect } from '../connection'
import { getWebSocket } from '../../selectors/communicationsLayer'

export const ESTABLISH_WEB_SOCKET_ATTEMPT = 'ESTABLISH_WEB_SOCKET_ATTEMPT'
export const ESTABLISH_WEB_SOCKET_ERROR = 'ESTABLISH_WEB_SOCKET_ERROR'
export const ESTABLISH_WEB_SOCKET_SUCCESS = 'ESTABLISH_WEB_SOCKET_SUCCESS'
export const DISCONNECT_WEB_SOCKET = 'DISCONNECT_WEB_SOCKET'

const establishWebSocketAttempt = {
    type: ESTABLISH_WEB_SOCKET_ATTEMPT
}

const establishWebSocketError = {
    type: ESTABLISH_WEB_SOCKET_ERROR
}

export const establishWebSocket = (dispatch) => {

    dispatch(establishWebSocketAttempt)

    let setupSocket = new WebSocket(WSS_ADDRESS)
    setupSocket.onopen = () => {
        dispatch(disconnectWebSocket)
        const pingInterval = setInterval(() => { setupSocket.send(JSON.stringify({ message: 'ping'}))}, 300000)
        const refreshTimeout = setTimeout(() => { dispatch(establishWebSocket) }, 3600000 )
        dispatch({
            type: ESTABLISH_WEB_SOCKET_SUCCESS,
            payload: {
                webSocket,
                pingInterval,
                refreshTimeout
            }
        })
    }
    setupSocket.onerror = (event) => {
        dispatch(establishWebSocketError)
    }
}

export const disconnectWebSocket = (dispatch, getState) => {
    const { webSocket, pingInterval, refreshTimeout } = getWebSocket(getState()) || {}
    if (pingInterval) {
        clearInterval(pingInterval)
    }
    if (refreshTimeout) {
        clearTimeout(refreshTimeout)
    }
    if (webSocket) {
        webSocket.close()
    }
    dispatch({ type: DISCONNECT_WEB_SOCKET })
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
export const socketDispatch = (messageType) => (payload) => (getState) => {
    const { status, webSocket } = getWebSocket(getState()) || {}
    if (webSocket && status === 'CONNECTED') {
        webSocket.send(JSON.stringify({
            message: messageType,
            data: payload
        }))
    }
}