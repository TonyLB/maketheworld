import { ESTABLISH_WEB_SOCKET_ATTEMPT, ESTABLISH_WEB_SOCKET_ERROR, ESTABLISH_WEB_SOCKET_SUCCESS, DISCONNECT_WEB_SOCKET } from '../../actions/communicationsLayer/webSocket.js'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", payload = {} } = action
    switch (actionType) {
        case ESTABLISH_WEB_SOCKET_SUCCESS:
            const { webSocket, pingInterval, refreshTimeout } = payload
            if (webSocket) {
                return {
                    status: 'CONNECTED',
                    webSocket,
                    pingInterval,
                    refreshTimeout
                }
            }
            else {
                return state
            }
        case ESTABLISH_WEB_SOCKET_ATTEMPT:
            return {
                ...state,
                status: 'CONNECTING'
            }
        case ESTABLISH_WEB_SOCKET_ERROR:
            return {
                ...state,
                status: 'ERROR'
            }
        case DISCONNECT_WEB_SOCKET:
            return {
                status: 'DISCONNECTED'
            }
        default: return state
    }
}

export default reducer