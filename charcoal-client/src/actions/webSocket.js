import { WSS_ADDRESS } from '../config'
import { getWebSocket } from '../selectors/webSocket'

export const ESTABLISH_WEB_SOCKET_ATTEMPT = 'ESTABLISH_WEB_SOCKET_ATTEMPT'
export const ESTABLISH_WEB_SOCKET_ERROR = 'ESTABLISH_WEB_SOCKET_ERROR'
export const REGISTER_WEB_SOCKET = 'REGISTER_WEB_SOCKET'

const establishWebSocketAttempt = {
    type: ESTABLISH_WEB_SOCKET_ATTEMPT
}

const establishWebSocketError = {
    type: ESTABLISH_WEB_SOCKET_ERROR
}

export const establishWebSocket = (CharacterId) => (dispatch) => {

    dispatch(establishWebSocketAttempt)
    console.log(`Establishing Web Socket (Character Id: ${CharacterId}`)

    let setupSocket = new WebSocket(WSS_ADDRESS)
    setupSocket.onopen = () => {
        console.log(`Socket open`)
        setupSocket.send(JSON.stringify({
            message: 'registercharacter',
            CharacterId
        }))
    }
    setupSocket.onmessage = (event) => {
        console.log(`Event: ${JSON.stringify(event, null, 4)}`)
        const { message } = JSON.parse(event.data || {})
        switch(message) {
            case 'Registered':
                console.log(`Registration message received`)
                dispatch(registerWebSocket({ webSocket: setupSocket, CharacterId }))
                break
            default:
                break
        }
    }
    setupSocket.onerror = (event) => {
        console.log(`WebSocket Error: ${JSON.stringify(event, null, 4)}`)
        dispatch(establishWebSocketError)
    }
}

export const registerWebSocket = ({ webSocket, CharacterId }) => (dispatch, getState) => {
    const { webSocket: oldWebSocket, pingInterval: oldPingInterval } = getWebSocket(getState()) || {}
    if (oldPingInterval) {
        clearInterval(oldPingInterval)
    }
    if (oldWebSocket) {
        oldWebSocket.close()
    }
    const pingInterval = setInterval(() => { webSocket.send(JSON.stringify({ message: 'ping'}))}, 300000)
    const refreshTimeout = setTimeout(() => { dispatch(establishWebSocket(CharacterId)) }, 3600000 )
    dispatch({
        type: REGISTER_WEB_SOCKET,
        payload: {
            webSocket,
            pingInterval,
            refreshTimeout
        }
    })
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