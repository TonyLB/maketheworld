import { WSS_ADDRESS } from '../../config'
import { ISSMTemplate, ISSMPotentialState, registerSSM, assertIntent, externalStateChange } from '../stateSeekingMachine'
import { getLifeLine } from '../../selectors/communicationsLayer'

export const ESTABLISH_WEB_SOCKET_ATTEMPT = 'ESTABLISH_WEB_SOCKET_ATTEMPT'
export const ESTABLISH_WEB_SOCKET_ERROR = 'ESTABLISH_WEB_SOCKET_ERROR'
export const ESTABLISH_WEB_SOCKET_SUCCESS = 'ESTABLISH_WEB_SOCKET_SUCCESS'
export const DISCONNECT_WEB_SOCKET = 'DISCONNECT_WEB_SOCKET'

type lifeLineSSMKeys = 'INITIAL' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING' | 'STALE' | 'RECONNECTING'
const LifeLineSSMKey = 'LifeLine'

const stateUpdate = (newState: lifeLineSSMKeys) => externalStateChange<lifeLineSSMKeys>({ key: LifeLineSSMKey, newState })

export const establishWebSocket = (dispatch: any) => {
    return new Promise<void>((resolve, reject) => {
        let setupSocket = new WebSocket(WSS_ADDRESS)
        setupSocket.onopen = () => {
            //
            // Make sure that any previous websocket is disconnected.
            //
            dispatch(disconnectWebSocket)
            const pingInterval = setInterval(() => { dispatch(socketDispatch('ping')({})) }, 300000)
            const refreshTimeout = setTimeout(() => { dispatch(stateUpdate('STALE')) }, 3600000 )
            dispatch({
                type: ESTABLISH_WEB_SOCKET_SUCCESS,
                payload: {
                    webSocket: setupSocket,
                    pingInterval,
                    refreshTimeout
                }
            })
            resolve()
        }
        setupSocket.onerror = (event) => {
            reject()
        }    
    })
}

export const disconnectWebSocket = (dispatch: any, getState: any) => {
    const { webSocket, pingInterval, refreshTimeout }: any = getLifeLine(getState()) || {}
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
// TODO:  Create typescript constraints for messageType and payload
//
// TODO:  Enqueue messages that come in when status is not connected, and flush the
//   queue through the lifeline when status returns to connected.
//
export const socketDispatch = (messageType: any) => (payload: any) => (dispatch: any, getState: any) => {
    const { status, webSocket }: any = getLifeLine(getState()) || {}
    if (webSocket && status === 'CONNECTED') {
        webSocket.send(JSON.stringify({
            message: messageType,
            ...payload
        }))
    }
}

export const registerCharacter = (CharacterId: string) => { socketDispatch('registercharacter')({ CharacterId }) }

//
// Implement a state-seeking machine to keep websockets connected where possible.
//
class LifeLineSSM implements ISSMTemplate<lifeLineSSMKeys> {
    initialState: lifeLineSSMKeys = 'INITIAL'
    states: Record<lifeLineSSMKeys, ISSMPotentialState<lifeLineSSMKeys>> = {
        INITIAL: {
            stateType: 'CHOICE',
            key: 'INITIAL',
            choices: ['CONNECTING']
        },
        CONNECTING: {
            stateType: 'ATTEMPT',
            key: 'CONNECTING',
            action: establishWebSocket,
            resolve: 'CONNECTED',
            reject: 'INITIAL'
        },
        CONNECTED: {
            stateType: 'CHOICE',
            key: 'CONNECTED',
            choices: ['DISCONNECTING', 'STALE']
        },
        DISCONNECTING: {
            stateType: 'ATTEMPT',
            key: 'DISCONNECTING',
            action: disconnectWebSocket,
            resolve: 'INITIAL',
            reject: 'INITIAL'
        },
        STALE: {
            stateType: 'CHOICE',
            key: 'STALE',
            choices: ['RECONNECTING', 'DISCONNECTING']
        },
        RECONNECTING: {
            stateType: 'ATTEMPT',
            key: 'RECONNECTING',
            action: establishWebSocket,
            resolve: 'CONNECTED',
            reject: 'INITIAL'
        }
    }
}

export const registerLifeLineSSM = (dispatch: any): void => {
    dispatch(registerSSM<lifeLineSSMKeys>({ key: 'LifeLine', template: new LifeLineSSM() }))
    dispatch(assertIntent({ key: 'LifeLine', newState: 'CONNECTED' }))
}