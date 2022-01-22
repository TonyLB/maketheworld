import { v4 as uuidv4 } from 'uuid'
import { Auth } from 'aws-amplify'
import { AnyAction } from 'redux'
import { ThunkAction } from 'redux-thunk'

import { WSS_ADDRESS } from '../../config'
import { LifeLineAction, LifeLineReturn } from './baseClasses'
import { AppDispatch, AppGetState, RootState } from '../../store'

import { LifeLinePubSubData } from './lifeLine'
import { PubSub } from '../../lib/pubSub'

import delayPromise from '../../lib/delayPromise'

import { cacheMessages } from '../messages'
import { getMyCharacterById  } from '../player'

export const LifeLinePubSub = new PubSub<LifeLinePubSubData>()

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
        dispatch(cacheMessages(payload.messages))
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
export const socketDispatch = (messageType: any) => (payload: any): ThunkAction<void, RootState, unknown, AnyAction> => (dispatch: AppDispatch, getState: AppGetState): void => {
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
export const socketDispatchPromise = (messageType: any) => (payload: any): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction> => (dispatch, getState) => {
    const { status, webSocket }: any = getLifeLine(getState()) || {}
    if (webSocket && status === 'CONNECTED') {
        const RequestId = uuidv4()
        return new Promise((resolve, reject) => {
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

export const moveCharacter = (CharacterId: string) => ({ ExitName, RoomId }: { ExitName: string; RoomId: string }): ThunkAction<void, RootState, unknown, AnyAction> => (dispatch) => {
    dispatch(socketDispatch('action')({ actionType: 'move', payload: { CharacterId, ExitName, RoomId } }))
}

export const parseCommand = (CharacterId: string) => ({ entry }: { entry: string; raiseError: any }): ThunkAction<boolean, RootState, unknown, AnyAction> => (dispatch, getState) => {

    const { Name } = getMyCharacterById(CharacterId)(getState())
    //
    // TODO: Add more graphical mode-switching to the text entry, so that you can visually differentiate whether you're
    // saying things, or entering commands, or posing, or spoofing.  Replace prefix codes with keyboard shortcuts that
    // change the mode (as well as a Speed-Dial set of buttons for switching context)
    //
    if (entry.slice(0,1) === '"' && entry.length > 1) {
        dispatch(socketDispatch('action')({ actionType: 'SayMessage', payload: { CharacterId, Message: entry.slice(1) } }))
        return true
    }
    if (entry.slice(0,1) === '@' && entry.length > 1) {
        dispatch(socketDispatch('action')({ actionType: 'NarrateMessage', payload: { CharacterId, Message: entry.slice(1) } }))
        return true
    }
    if (entry.slice(0,1) === ':' && entry.length > 1) {
        const MessagePostfix = entry.slice(1)
        const Message = `${Name}${MessagePostfix.match(/^[,']/) ? "" : " "}${MessagePostfix}`
        dispatch(socketDispatch('action')({ actionType: 'NarrateMessage', payload: { CharacterId, Message } }))
        return true
    }
    if (entry) {
        dispatch(socketDispatch('command')({ CharacterId, command: entry }))
        //
        // TODO: Use raiseError to handle return errors from the back-end command parser
        //
        return true
    }
    return false
}