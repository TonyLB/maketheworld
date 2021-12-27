import { ESTABLISH_WEB_SOCKET_SUCCESS, DISCONNECT_WEB_SOCKET } from '../../actions/communicationsLayer/lifeLine/index.ts'

export const reducer = (state = {}, action = {}) => {
    const { type: actionType = "NOOP", payload = {} } = action
    switch (actionType) {
        case ESTABLISH_WEB_SOCKET_SUCCESS:
            const { webSocket, pingInterval, refreshTimeout } = payload
            if (webSocket) {
                return {
                    webSocket,
                    pingInterval,
                    refreshTimeout
                }
            }
            else {
                return state
            }
        case DISCONNECT_WEB_SOCKET:
            return {}
        default: return state
    }
}

export default reducer