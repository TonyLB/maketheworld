import { REGISTER_WEB_SOCKET } from '../actions/webSocket.js'

export const reducer = (state = null, action = {}) => {
    const { type: actionType = "NOOP", payload = {} } = action
    switch (actionType) {
        case REGISTER_WEB_SOCKET:
            const { webSocket } = payload
            if (webSocket) {
                return payload
            }
            else {
                return state
            }
        default: return state
    }
}

export default reducer