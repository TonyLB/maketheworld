import { v4 as uuidv4 } from 'uuid'
import { AnyAction } from 'redux'
import { ThunkAction } from 'redux-thunk'

import {
    LifeLineAction,
    LifeLineReturn,
    LifeLineCondition,
    ParseCommandProps
} from './baseClasses'
import { AppDispatch, AppGetState, RootState } from '../../store'

import { LifeLinePubSubData } from './lifeLine'
import { PubSub } from '../../lib/pubSub'

import delayPromise from '../../lib/delayPromise'

import { cacheMessages } from '../messages'
import { receiveMessages as perceptionCacheReceiveMessages } from '../perceptionCache'

import { EphemeraAPIMessage, isEphemeraClientMessage } from '@tonylb/mtw-interfaces/dist/ephemera'
import { AssetAPIMessage, isAssetClientMessage } from '@tonylb/mtw-interfaces/dist/asset'
import { isSubscriptionClientMessage, SubscriptionsAPIMessage } from '@tonylb/mtw-interfaces/dist/subscriptions'
import { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { isCoordinationClientMessage } from '@tonylb/mtw-interfaces/dist/coordination'
import { getConfiguration, receiveRefreshToken } from '../configuration'
import { cacheNotifications } from '../notifications'
import { Notification, InformationNotification } from '@tonylb/mtw-interfaces/dist/messages'
import { push } from '../UI/feedback'
import { getPlayer } from '../player'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import { anonymousAPIPromise, isAnonymousAPIResultAccessTokenFailure, isAnonymousAPIResultAccessTokenSuccess } from '../../anonymousAPI'

export const LifeLinePubSub = new PubSub<LifeLinePubSubData>()

export const refreshTokenCondition: LifeLineCondition = ({}, getState) => {
    const state = getState()
    const { RefreshToken } = getConfiguration(state)

    return Boolean(RefreshToken)
}

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
        dispatch(cacheMessages(payload))
        dispatch(perceptionCacheReceiveMessages(payload.messages))
    }
}

const receiveNotifications = (dispatch: any) => ({ payload }: { payload: LifeLinePubSubData}) => {
    if (payload.messageType === 'Notifications') {
        dispatch(cacheNotifications(payload.notifications.filter((value: Notification): value is InformationNotification => (value.DisplayProtocol === 'Information'))))
    }
}

export const subscribeMessages: LifeLineAction = () => async (dispatch) => {
    const messageSubscription = LifeLinePubSub.subscribe(receiveMessages(dispatch))
    const notificationSubscription = LifeLinePubSub.subscribe(receiveNotifications(dispatch))
    return { internalData: { messageSubscription, notificationSubscription }}
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
export function socketDispatch(payload: EphemeraAPIMessage, options?: { service: 'ephemera' }): ThunkAction<void, RootState, unknown, AnyAction>;
export function socketDispatch(payload: AssetAPIMessage, options: { service: 'asset' }): ThunkAction<void, RootState, unknown, AnyAction>;
export function socketDispatch(payload: SubscriptionsAPIMessage, options: { service: 'subscriptions' }): ThunkAction<void, RootState, unknown, AnyAction>;
export function socketDispatch(payload: { messageType: 'ping' }, options: { service: 'ping' }): ThunkAction<void, RootState, unknown, AnyAction>;
export function socketDispatch(payload: EphemeraAPIMessage | AssetAPIMessage | SubscriptionsAPIMessage | { messageType: 'ping' }, options: { service?: 'ephemera' | 'asset' | 'subscriptions' | 'ping'}): ThunkAction<void, RootState, unknown, AnyAction>
export function socketDispatch(payload: EphemeraAPIMessage | AssetAPIMessage | SubscriptionsAPIMessage | { messageType: 'ping' }, { service = 'ephemera' }: { service?: 'ephemera' | 'asset' | 'subscriptions' | 'ping'} = {}): ThunkAction<void, RootState, unknown, AnyAction> {
    return (dispatch: AppDispatch, getState: AppGetState): void => {
        const { status, webSocket }: any = getLifeLine(getState()) || {}
        if (webSocket && status === 'CONNECTED') {
            webSocket.send(JSON.stringify({
                service,
                ...payload
            }))
        }
    }
}

export const establishWebSocket: LifeLineAction = (arg) => async (dispatch, getState) => {
    //
    // Pull a Cognito authentication token in order to connect to the webSocket
    //
    const { publicData: { webSocket, IDToken }, actions: { internalStateChange }} = arg
    const { WebSocketURI, RefreshToken, AnonymousAPIURI } = getConfiguration(getState())
    const { SessionId } = getPlayer(getState())
    //
    // Use the RefreshToken to get an IDToken to pass to the websocket for authentication
    //
    if (!AnonymousAPIURI) {
        return Promise.reject({})
    }
    let finalIDToken = IDToken
    if (!finalIDToken) {
        const result = await anonymousAPIPromise({
            path: 'accessToken',
            RefreshToken
        }, AnonymousAPIURI)
        if (isAnonymousAPIResultAccessTokenFailure(result)) {
            dispatch(receiveRefreshToken(undefined))
            return Promise.reject({})
        }
        if (isAnonymousAPIResultAccessTokenSuccess(result)) {
            finalIDToken = result.IdToken
        }
    }
    return new Promise<LifeLineReturn>((resolve, reject) => {
        let setupSocket = new WebSocket(`${WebSocketURI}?Authorization=${finalIDToken}${ SessionId ? `&SessionId=${SessionId}` : '' }`)
        setupSocket.onopen = () => {
            //
            // Make sure that any previous websocket is disconnected.
            //
            if (webSocket) {
                dispatch(disconnectWebSocket(arg))
            }
            const pingInterval = setInterval(() => { dispatch(socketDispatch({ messageType: 'ping' }, { service: 'ping' })) }, 300000)
            const refreshTimeout = setTimeout(() => {
                dispatch(internalStateChange({ newState: 'STALE' }))
                dispatch(heartbeat)
            }, 3600000 )
            resolve({
                internalData: {
                    pingInterval,
                    refreshTimeout,
                    incrementalBackoff: 0.5
                },
                publicData: {
                    webSocket: setupSocket,
                    IDToken: ''
                }
            })
        }
        setupSocket.onmessage = (event) => {
            const payload = JSON.parse(event.data || {})
            const isEmptyClientMessage = (payload: any) => (Object.keys(payload).length === 0 || (Object.keys(payload).length === 1 && 'RequestId' in payload))
            const isPongMessage = (payload: any) => ('type' in payload && payload.type === 'pong')
            if (isEphemeraClientMessage(payload) || isAssetClientMessage(payload) || isCoordinationClientMessage(payload) || isSubscriptionClientMessage(payload)) {
                LifeLinePubSub.publish(payload)
            }
            else {
                if (!(isEmptyClientMessage(payload) || isPongMessage(payload))) {
                    console.log(`INVALID MESSAGE: ${JSON.stringify(payload, null, 4)}`)
                }
            }
        }
        setupSocket.onerror = (event) => {
            reject({
                publicData: {
                    IDToken: ''
                }
            })
        }
    })

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
export function socketDispatchPromise(payload: EphemeraAPIMessage, options?: { service: 'ephemera' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: AssetAPIMessage, options: { service: 'asset' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: SubscriptionsAPIMessage, options: { service: 'subscriptions' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: { messageType: 'ping' }, options: { service: 'ping' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: EphemeraAPIMessage | AssetAPIMessage | SubscriptionsAPIMessage | { messageType: 'ping' }, options: { service?: 'ephemera' | 'asset' | 'subscriptions' | 'ping'}): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>
export function socketDispatchPromise(payload: EphemeraAPIMessage | AssetAPIMessage | SubscriptionsAPIMessage | { messageType: 'ping' }, { service = 'ephemera' }: { service?: 'ephemera' | 'asset' | 'subscriptions' | 'ping' } = {}): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction> {
    return (dispatch, getState) => {
        const { status, webSocket }: any = getLifeLine(getState()) || {}
        if (webSocket && status === 'CONNECTED') {
            const RequestId = uuidv4()
            return new Promise((resolve, reject) => {
                LifeLinePubSub.subscribe(({ payload, unsubscribe }) => {
                    const { RequestId: compareRequestId, ...rest } = payload
                    if (compareRequestId === RequestId) {
                        unsubscribe()
                        if (payload.messageType === 'Error') {
                            dispatch(push(payload.error))
                            reject(payload)
                        }
                        else {
                            resolve(payload)
                        }
                    }
                })
                webSocket.send(JSON.stringify({
                    service,
                    ...payload,
                    RequestId
                }))
            })
        }
        else {
            //
            // TODO: Don't immediately reject on unconnected websocket:  Cache the
            // data in a way that will get flushed when the socket reopens
            //
            return Promise.reject({
                message: (payload as any).message
            })
        }
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
                    reject(payload)
                }
                else {
                    resolve(payload)
                }
            }
        })
        fetch(url, {
            method: 'PUT',
            body: payload
        })
    })
}

export const moveCharacter = (CharacterId: EphemeraCharacterId) => ({ ExitName, RoomId }: { ExitName: string; RoomId: EphemeraRoomId }): ThunkAction<void, RootState, unknown, AnyAction> => (dispatch) => {
    dispatch(socketDispatch({ message: 'action', actionType: 'move', payload: { CharacterId, ExitName, RoomId } }))
}

export const parseCommand = (CharacterId: EphemeraCharacterId) => ({ mode, entry }: ParseCommandProps): ThunkAction<boolean, RootState, unknown, AnyAction> => (dispatch) => {
    if (mode === 'Command') {
        dispatch(socketDispatch({ message: 'command', CharacterId, command: entry }))
        //
        // TODO: Use raiseError to handle return errors from the back-end command parser
        //
        return true
    }
    else{
        dispatch(socketDispatch({ message: 'action', actionType: mode, payload: { CharacterId, Message: entry } }))
        return true
    }
}