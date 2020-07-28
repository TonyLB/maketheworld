import { getWebSocket } from '../selectors/webSocket'

export const CONNECTION_REGISTER = 'CONNECTION_REGISTER'
export const DISCONNECT_REGISTER = 'DISCONNECT_REGISTER'

export const connectionRegister = ({ characterId }) => ({
    type: CONNECTION_REGISTER,
    payload: {
        characterId
    }
})

export const disconnectRegister = {
    type: DISCONNECT_REGISTER
}

export const disconnect = () => (dispatch, getState) => {
    const state = getState()
    const { webSocket, pingInterval, refreshTimeout } = getWebSocket(state)
    if (pingInterval) {
        clearInterval(pingInterval)
    }
    if (refreshTimeout) {
        clearTimeout(refreshTimeout)
    }
    if (webSocket) {
        webSocket.close()
    }

    dispatch(disconnectRegister)
}