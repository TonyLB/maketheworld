import { v4 as uuidv4 } from 'uuid'
import { Auth } from 'aws-amplify'

import { WSS_ADDRESS } from '../../config'
import { LifeLineAction, LifeLineReturn } from './baseClasses'

import { LifeLinePubSubData } from './lifeLine'
import { PubSub } from '../../lib/pubSub'

import delayPromise from '../../lib/delayPromise'

export const LifeLinePubSub = new PubSub<LifeLinePubSubData>()

export const RECEIVE_JSON_MESSAGES = 'RECEIVE_JSON_MESSAGES'

export const unsubscribeMessages: LifeLineAction = ({ internalData: { messageSubscription } }) => async () => {
    if (messageSubscription) {
        LifeLinePubSub.unsubscribe(messageSubscription)
    }
    return { internalData: { messageSubscription: null }}
}

export const disconnectWebSocket: LifeLineAction = ({ internalData: { pingInterval, refreshTimeout }, publicData: { webSocket } }) => async (dispatch: any, getState: any) => {
    if (pingInterval) {
        clearInterval(pingInterval)
    }
    if (refreshTimeout) {
        clearTimeout(refreshTimeout)
    }
    if (webSocket) {
        webSocket.close()
    }
    return {
        internalData: {
            pingInterval: null,
            refreshTimeout: null
        },
        publicData: {
            webSocket: null
        }
    }
}

//
// getLifeLine is a local utility selector, to pull information from the SSM slice structure
//
const getLifeLine = (state: any) => ({
    status: state.lifeLine.meta.currentState,
    webSocket: state.lifeLine.publicData.webSocket
})

const receiveMessages = (dispatch: any) => ({ payload }: { payload: LifeLinePubSubData}) => {
    if (payload.messageType === 'Messages') {
        dispatch({
            type: RECEIVE_JSON_MESSAGES,
            payload: payload.messages
        })
    }
}

export const subscribeMessages: LifeLineAction = () => async (dispatch) => {
    const messageSubscription = LifeLinePubSub.subscribe(receiveMessages(dispatch))
    return { internalData: { messageSubscription }}
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

export const establishWebSocket: LifeLineAction = ({ publicData: { webSocket }, actions: { internalStateChange }}) => async (dispatch) => {
    //
    // Pull a Cognito authentication token in order to connect to the webSocket
    //
    return Auth.currentSession()
        .then((session) => (session.getIdToken().getJwtToken()))
        .then((token) => (new Promise<LifeLineReturn>((resolve, reject) => {
            let setupSocket = new WebSocket(`${WSS_ADDRESS}?Authorization=${token}`)
            setupSocket.onopen = () => {
                //
                // Make sure that any previous websocket is disconnected.
                //
                if (webSocket) {
                    dispatch(disconnectWebSocket)
                }
                const pingInterval = setInterval(() => { dispatch(socketDispatch('ping')({})) }, 300000)
                const refreshTimeout = setTimeout(() => { dispatch(internalStateChange({ newState: 'STALE' })) }, 3600000 )
                resolve({
                    internalData: {
                        pingInterval,
                        refreshTimeout,
                        incrementalBackoff: 0.5
                    },
                    publicData: {
                        webSocket: setupSocket
                    }
                })
            }
            setupSocket.onmessage = (event) => {
                const payload = JSON.parse(event.data || {}) as LifeLinePubSubData
                LifeLinePubSub.publish(payload)
            }
            setupSocket.onerror = (event) => {
                reject({})
            }
        })
    ))

}

export const backoffAction: LifeLineAction = ({ internalData: { incrementalBackoff = 0.5 }}) => async (dispatch) => {
    if (incrementalBackoff >= 30) {
        throw new Error()
    }
    await delayPromise(incrementalBackoff * 1000)
    return { internalData: { incrementalBackoff: Math.min(incrementalBackoff * 2, 30) } }
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

//
// apiDispatchPromise passes a client-side RequestId so that a given upload can be linked with the
// subscription set on it in the Assets table.  This lets some message types associate an expected
// upload and receipt, treat it as a round-trip and return a Promise that watches for that (similar
// to how HTTP calls are processed).
//
export const apiDispatchPromise = (url: string, RequestId: string) => (payload: any) =>  {
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
        fetch(url, {
            method: 'PUT',
            body: payload
        })
    })
}
