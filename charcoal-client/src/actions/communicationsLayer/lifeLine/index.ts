import { v4 as uuidv4 } from 'uuid'
import { Auth } from 'aws-amplify'

import { WSS_ADDRESS } from '../../../config'
import { registerSSM, assertIntent, externalStateChange } from '../../stateSeekingMachine'
import { getLifeLine } from '../../../selectors/communicationsLayer'
import { lifeLineSSMKeys, ILifeLineSSM, LifeLineData, ILifeLineState, LifeLineSSMKey } from './baseClass'
import { IStateSeekingMachineAbstract } from '../../stateSeekingMachine/baseClasses'
import { LifeLinePubSubData } from './lifeLine'

import { PubSub } from '../../../lib/pubSub'
import { RECEIVE_EPHEMERA_CHANGE } from '../appSyncSubscriptions/ephemeraSubscription'

export const ESTABLISH_WEB_SOCKET_ATTEMPT = 'ESTABLISH_WEB_SOCKET_ATTEMPT'
export const ESTABLISH_WEB_SOCKET_ERROR = 'ESTABLISH_WEB_SOCKET_ERROR'
export const ESTABLISH_WEB_SOCKET_SUCCESS = 'ESTABLISH_WEB_SOCKET_SUCCESS'
export const DISCONNECT_WEB_SOCKET = 'DISCONNECT_WEB_SOCKET'
export const RECEIVE_JSON_MESSAGES = 'RECEIVE_JSON_MESSAGES'

export const LifeLinePubSub = new PubSub<LifeLinePubSubData>()

const stateUpdate = (newState: lifeLineSSMKeys) => externalStateChange<lifeLineSSMKeys>({ key: LifeLineSSMKey, newState })

export const establishWebSocket = ({ webSocket, incrementalBackoff }: LifeLineData) => (dispatch: any): Promise<Partial<LifeLineData>> => {
    //
    // Pull a Cognito authentication token in order to connect to the webSocket
    //
    return Auth.currentSession()
        .then((session) => (session.getIdToken().getJwtToken()))
        .then((token) => (new Promise<Partial<LifeLineData>>((resolve, reject) => {
            let setupSocket = new WebSocket(`${WSS_ADDRESS}?Authorization=${token}`)
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
                    refreshTimeout,
                    incrementalBackoff: 0.5
                })
            }
            setupSocket.onmessage = (event) => {
                const payload = JSON.parse(event.data || {}) as LifeLinePubSubData
                LifeLinePubSub.publish(payload)
            }
            setupSocket.onerror = (event) => {
                setTimeout(() => { reject({ incrementalBackoff: Math.min(incrementalBackoff * 2, 20000) })}, 1000 * incrementalBackoff)
            }
        })
    ))
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
// Implement a state-seeking machine to keep websockets connected where possible.
//
export class LifeLineTemplate implements ILifeLineSSM {
    ssmType: 'LifeLine' = 'LifeLine'
    initialState: lifeLineSSMKeys = 'INITIAL'
    initialData: LifeLineData = new LifeLineData(LifeLinePubSub)
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

// const receiveEphemera = (dispatch: any) => ({ payload }: { payload: LifeLinePubSubData }) => {
//     if (payload.messageType === 'Ephemera') {
//         dispatch({
//             type: RECEIVE_EPHEMERA_CHANGE,
//             payload: payload.updates
//         })
//     }
// }

export const registerLifeLineSSM = (dispatch: any): void => {
    dispatch(registerSSM({ key: 'LifeLine', template: new LifeLineTemplate(), defaultIntent: 'CONNECTED' }))
    LifeLinePubSub.subscribe(receiveMessages(dispatch))
    // LifeLinePubSub.subscribe(receiveEphemera(dispatch))
}

export const fetchEphemera = (dispatch: any) => {
    dispatch(socketDispatch('fetchephemera'))()
}

//
// socketDispatchPromise lets the back-end label which RequestId a given message responds-to/resolves.
// This lets some message types associate an expected round-trip and return a Promise that watches
// for that (similar to how HTTP calls are processed).
//
export const socketDispatchPromise = (messageType: any) => (payload: any) => (dispatch: any, getState: any) => {
    const { status, webSocket }: any = getLifeLine(getState()) || {}
    if (webSocket && status === 'CONNECTED') {
        const RequestId = uuidv4()
        return new Promise<LifeLinePubSubData>((resolve, reject) => {
            LifeLinePubSub.subscribe(({ payload, unsubscribe }) => {
                const { RequestId: compareRequestId, ...rest } = payload
                if (compareRequestId === RequestId) {
                    unsubscribe()
                    if (payload.messageType === 'Error') {
                        reject(rest)
                    }
                    else {
                        resolve(rest)
                    }
                }
            })
            webSocket.send(JSON.stringify({
                message: messageType,
                RequestId,
                ...payload
            }))
        })
    }
    else {
        //
        // TODO: Don't immediately reject on unconnected websocket:  Cache the
        // data in a way that will get flushed when the socket reopens
        //
        return Promise.reject({
            messageType
        })
    }
}

export const registerCharacter = (CharacterId: string) => (dispatch: any) => (
    //
    // TODO:
    //
    //   * Remove debug messages
    //   * Refactor calls to registerCharacter to directly use socketDispatchPromise,
    //     and handle both resolve and reject outcomes (rather than assuming a
    //     successful resolution)
    //
    dispatch(socketDispatchPromise('registercharacter')({ CharacterId }))
        .catch((error: any) => {
            console.log(`Socket Error: ${JSON.stringify(error, null, 4)}`)
        })

)
