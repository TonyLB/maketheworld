export const REGISTER_WEB_SOCKET = 'REGISTER_WEB_SOCKET'

export const registerWebSocket = (webSocket) => {
    return {
        type: REGISTER_WEB_SOCKET,
        payload: {
            webSocket
        }
    }
}