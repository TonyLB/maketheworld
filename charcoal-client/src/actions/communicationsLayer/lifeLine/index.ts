import { WSS_ADDRESS } from '../../../config'
import { registerSSM, assertIntent, externalStateChange } from '../../stateSeekingMachine'
import { getLifeLine } from '../../../selectors/communicationsLayer'
import { lifeLineSSMKeys, ILifeLineSSM, LifeLineData, ILifeLineState, LifeLineSSMKey } from './baseClass'
import { IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'
import { MessageFormat } from './messages'

import { PubSub } from '../../../lib/pubSub'

export const ESTABLISH_WEB_SOCKET_ATTEMPT = 'ESTABLISH_WEB_SOCKET_ATTEMPT'
export const ESTABLISH_WEB_SOCKET_ERROR = 'ESTABLISH_WEB_SOCKET_ERROR'
export const ESTABLISH_WEB_SOCKET_SUCCESS = 'ESTABLISH_WEB_SOCKET_SUCCESS'
export const DISCONNECT_WEB_SOCKET = 'DISCONNECT_WEB_SOCKET'
export const RECEIVE_JSON_MESSAGES = 'RECEIVE_JSON_MESSAGES'

type LifeLineRegisterMessage = {
    messageType: 'Registered';
    CharacterId: string;
}

type LifeLineReceiveMessage = {
    messageType: 'Messages',
    messages: MessageFormat[]
}

type LifeLinePubSubData = LifeLineRegisterMessage | LifeLineReceiveMessage

const LifeLinePubSub = new PubSub<LifeLinePubSubData>()

const stateUpdate = (newState: lifeLineSSMKeys) => externalStateChange<lifeLineSSMKeys>({ key: LifeLineSSMKey, newState })

export const establishWebSocket = ({ webSocket }: LifeLineData) => (dispatch: any): Promise<Partial<LifeLineData>> => {
    return new Promise<LifeLineData>((resolve, reject) => {
        let setupSocket = new WebSocket(WSS_ADDRESS)
        setupSocket.onopen = () => {
            //
            // Make sure that any previous websocket is disconnected.
            //
            if (webSocket) {
                dispatch(disconnectWebSocket)
            }
            const pingInterval = setInterval(() => { dispatch(socketDispatch('ping')({})) }, 300000)
            const refreshTimeout = setTimeout(() => { dispatch(stateUpdate('STALE')) }, 3600000 )
            resolve({
                webSocket: setupSocket,
                pingInterval,
                refreshTimeout
            })
        }
        setupSocket.onmessage = (event) => {
            const payload = JSON.parse(event.data || {}) as LifeLinePubSubData
            LifeLinePubSub.publish(payload)
        }
        setupSocket.onerror = (event) => {
            reject()
        }    
    })
}

export const disconnectWebSocket = ({ webSocket, pingInterval, refreshTimeout }: LifeLineData) => async (dispatch: any, getState: any) => {
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
    return {
        webSocket: null,
        pingInterval: null,
        refreshTimeout: null
    }
}

//
// TODO:  Create array storage in the lifelineData to keep track of listeners on the
// socket.  Register response-listeners when a character is registered, and use them
// to resolve the promise (so that registerCharacter can return a promise that
// resolves when the character *has been* registered, rather than adding epicycles
// permanently to the listener to always be on the lookout for a registerCharacter
// pingback)
//

//
// Implement a state-seeking machine to keep websockets connected where possible.
//
export class LifeLineTemplate implements ILifeLineSSM {
    ssmType: 'LifeLine' = 'LifeLine'
    initialState: lifeLineSSMKeys = 'INITIAL'
    initialData: LifeLineData = new LifeLineData()
    states: Record<lifeLineSSMKeys, ILifeLineState> = {
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

export type LifeLineSSM = IStateSeekingMachineAbstract<lifeLineSSMKeys, LifeLineData, LifeLineTemplate>

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

const receiveMessages = (dispatch: any) => ({ payload }: { payload: LifeLinePubSubData}) => {
    if (payload.messageType === 'Messages') {
        dispatch({
            type: RECEIVE_JSON_MESSAGES,
            payload: payload.messages
        })
    }
}

export const registerLifeLineSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'LifeLine', template: new LifeLineTemplate() }))
    dispatch(assertIntent({ key: 'LifeLine', newState: 'CONNECTED' }))
    LifeLinePubSub.subscribe(receiveMessages(dispatch))
}

export const registerCharacter = (CharacterId: string) => (dispatch: any) => (
    //
    // TODO:  Create error messaging that rejects the promise if it gets some sort
    // of register failure.
    //
    new Promise((resolve: any, reject: any) => {
        LifeLinePubSub.subscribe(({ payload, unsubscribe }) => {
            if (payload.messageType === 'Registered') {
                const { CharacterId: registeredCharacterId } = payload
                if (CharacterId === registeredCharacterId) {
                    unsubscribe()
                    resolve({})
                }
            }
        })
        dispatch(socketDispatch('registercharacter')({ CharacterId }))
    })
)
