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

import { EphemeraAPIMessage, isEphemeraClientMessage, isTerminalConversationStep } from '@tonylb/mtw-interfaces/ts/ephemera'
import { AssetAPIMessage, isAssetClientMessage } from '@tonylb/mtw-interfaces/ts/asset'
import { isSubscriptionClientMessage, SubscriptionsAPIMessage } from '@tonylb/mtw-interfaces/ts/subscriptions'
import { WMLAPIMessage } from '@tonylb/mtw-interfaces/ts/wml'
import { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isCoordinationClientMessage } from '@tonylb/mtw-interfaces/ts/coordination'
import { getConfiguration, receiveRefreshToken } from '../configuration'
import { push } from '../UI/feedback'
import { getSessionId, updateConnection } from '../settings'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import { anonymousAPIPromise, isAnonymousAPIResultAccessTokenFailure, isAnonymousAPIResultAccessTokenSuccess } from '../../anonymousAPI'
import { CoordinationClientSessionInitializedMessage } from '@tonylb/mtw-interfaces/ts/coordination'

export const LifeLinePubSub = new PubSub<LifeLinePubSubData>()

export const refreshTokenCondition: LifeLineCondition = ({}, getState) => {
    const state = getState()
    const { RefreshToken } = getConfiguration(state)

    return Boolean(RefreshToken)
}

export const unsubscribeMessages: LifeLineAction = ({ internalData: { messageSubscription, coordinationSubscription } }) => async () => {
    if (messageSubscription) {
        LifeLinePubSub.unsubscribe(messageSubscription)
    }
    if (coordinationSubscription) {
        LifeLinePubSub.unsubscribe(coordinationSubscription)
    }
    return { internalData: { messageSubscription: null, coordinationSubscription: null }}
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

// Handle SessionInitialized coordination message - store SessionId and PlayerName in settings
// This needs to be set up early, before the player slice subscribes, so we handle it in lifeLine
const receiveCoordinationMessages = (dispatch: any) => ({ payload }: { payload: LifeLinePubSubData}) => {
    if (isCoordinationClientMessage(payload) && payload.messageType === 'SessionInitialized') {
        const sessionInitialized = payload as CoordinationClientSessionInitializedMessage
        // Update connection info in settings slice
        dispatch(updateConnection({
            sessionId: sessionInitialized.SessionId,
            playerName: sessionInitialized.PlayerName
        }))
        // Trigger heartbeat so SSMs (like playerDataSource) can re-evaluate hold conditions
        dispatch(heartbeat)
    }
}

export const subscribeMessages: LifeLineAction = () => async (dispatch) => {
    const messageSubscription = LifeLinePubSub.subscribe(receiveMessages(dispatch))
    // Also subscribe to coordination messages (SessionInitialized) to update settings
    const coordinationSubscription = LifeLinePubSub.subscribe(receiveCoordinationMessages(dispatch))
    return { 
        internalData: { 
            messageSubscription,
            coordinationSubscription
        }
    }
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
    const SessionId = getSessionId(getState())
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
        } as any, AnonymousAPIURI)
        if (isAnonymousAPIResultAccessTokenFailure(result)) {
            dispatch(receiveRefreshToken(undefined))
            return Promise.reject({})
        }
        if (isAnonymousAPIResultAccessTokenSuccess(result)) {
            finalIDToken = result.IdToken
        }
    }
    // If we were unable to obtain an IdToken for any reason, clear RefreshToken and reject to stop reconnect loop
    if (!finalIDToken) {
        dispatch(receiveRefreshToken(undefined))
        return Promise.reject({})
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
            else if (typeof payload?.statusCode === 'number' && typeof payload?.body === 'string') {
                // Lambda return value: { statusCode: 200, body: JSON.stringify(body) }. Parse body so
                // subscribers (e.g. socketDispatchPromise) see RequestId and result at top level.
                try {
                    const parsed = JSON.parse(payload.body) as LifeLinePubSubData
                    LifeLinePubSub.publish(parsed)
                } catch (_) {
                    if (!(isEmptyClientMessage(payload) || isPongMessage(payload))) {
                        console.log(`INVALID MESSAGE: ${JSON.stringify(payload, null, 4)}`)
                    }
                }
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
        // Best-effort: if the server closes with an auth-related code, clear RefreshToken to force re-login
        setupSocket.onclose = (event) => {
            // 1008 Policy Violation often used for auth, and 4401/4403 are common custom auth codes
            const authRelated = event.code === 1008 || event.code === 4401 || event.code === 4403
            if (authRelated) {
                dispatch(receiveRefreshToken(undefined))
            }
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
export function socketDispatchPromise(payload: EphemeraAPIMessage & { RequestId?: string }, options?: { service: 'ephemera' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: AssetAPIMessage & { RequestId?: string }, options: { service: 'asset' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: SubscriptionsAPIMessage & { RequestId?: string }, options: { service: 'subscriptions' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: WMLAPIMessage, options: { service: 'wml' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: { messageType: 'ping', RequestId?: string }, options: { service: 'ping' }): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>;
export function socketDispatchPromise(payload: (EphemeraAPIMessage | AssetAPIMessage | SubscriptionsAPIMessage | { messageType: 'ping' }) & { RequestId?: string }, options: { service?: 'ephemera' | 'asset' | 'subscriptions' | 'ping'}): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction>
export function socketDispatchPromise(payload: (EphemeraAPIMessage | AssetAPIMessage | SubscriptionsAPIMessage | WMLAPIMessage | { messageType: 'ping' }) & { RequestId?: string }, { service = 'ephemera' }: { service?: 'ephemera' | 'asset' | 'wml' | 'subscriptions' | 'ping' } = {}): ThunkAction<Promise<LifeLinePubSubData>, RootState, unknown, AnyAction> {
    return (dispatch, getState) => {
        const { status, webSocket }: any = getLifeLine(getState()) || {}
        if (webSocket && status === 'CONNECTED') {
            const RequestId = payload.RequestId ?? uuidv4()
            return new Promise((resolve, reject) => {
                LifeLinePubSub.subscribe(({ payload, unsubscribe }) => {
                    const { RequestId: compareRequestId, ...rest } = payload
                    if (compareRequestId === RequestId) {
                        unsubscribe()
                        if (payload.messageType === 'Error') {
                            if (payload.error) {
                                dispatch(push(payload.error))
                            }
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

export type ConversationCorrelationParams = {
    conversationId: string
    requestId: string
    matchRequestIdFallback: boolean
}

/**
 * Pure filter: inbound WebSocket payloads belong to this conversation when `conversationId`
 * matches, or (migration) when `matchRequestIdFallback` is true and `RequestId` matches.
 */
export function matchesCorrelationPayload(
    payload: LifeLinePubSubData,
    { conversationId, requestId, matchRequestIdFallback }: ConversationCorrelationParams
): boolean {
    if (payload.conversationId === conversationId) {
        return true
    }
    if (matchRequestIdFallback && payload.RequestId === requestId) {
        return true
    }
    return false
}

export type SocketDispatchConversationOptions = {
    onEvent: (payload: LifeLinePubSubData) => void
    onTerminal?: (payload: LifeLinePubSubData) => void
    matchRequestIdFallback?: boolean
    isTerminal?: (payload: LifeLinePubSubData) => boolean
}

//
// socketDispatchConversation: subscribe to LifeLinePubSub for multiple inbound payloads sharing
// conversationId (and optionally RequestId during migration) until terminal or unsubscribe.
//
// Framework status: This was prototyped end-to-end with the removed workbench "room preview
// generation" flow. The mechanism is known to work and is expected to be useful for future
// Ephemera features that stream multiple correlated messages per outbound action. There are
// currently no production call sites in charcoal-client; the implementation is kept largely
// against that future need (see lifeLine/AGENT.md and lambda/ephemera/conversations/AGENT.md).
//
export function socketDispatchConversation(
    payload: EphemeraAPIMessage & { conversationId?: string },
    options: SocketDispatchConversationOptions & { service?: 'ephemera' }
): ThunkAction<Promise<{ unsubscribe: () => void; conversationId: string }>, RootState, unknown, AnyAction>
export function socketDispatchConversation(
    payload: AssetAPIMessage & { conversationId?: string },
    options: SocketDispatchConversationOptions & { service: 'asset' }
): ThunkAction<Promise<{ unsubscribe: () => void; conversationId: string }>, RootState, unknown, AnyAction>
export function socketDispatchConversation(
    payload: SubscriptionsAPIMessage & { conversationId?: string },
    options: SocketDispatchConversationOptions & { service: 'subscriptions' }
): ThunkAction<Promise<{ unsubscribe: () => void; conversationId: string }>, RootState, unknown, AnyAction>
export function socketDispatchConversation(
    payload: WMLAPIMessage & { conversationId?: string },
    options: SocketDispatchConversationOptions & { service: 'wml' }
): ThunkAction<Promise<{ unsubscribe: () => void; conversationId: string }>, RootState, unknown, AnyAction>
export function socketDispatchConversation(
    payload: { messageType: 'ping'; RequestId?: string; conversationId?: string },
    options: SocketDispatchConversationOptions & { service: 'ping' }
): ThunkAction<Promise<{ unsubscribe: () => void; conversationId: string }>, RootState, unknown, AnyAction>
export function socketDispatchConversation(
    payload: (EphemeraAPIMessage | AssetAPIMessage | SubscriptionsAPIMessage | WMLAPIMessage | { messageType: 'ping' }) & { conversationId?: string; RequestId?: string },
    {
        service = 'ephemera',
        onEvent,
        onTerminal,
        matchRequestIdFallback = false,
        isTerminal = isTerminalConversationStep,
    }: SocketDispatchConversationOptions & { service?: 'ephemera' | 'asset' | 'wml' | 'subscriptions' | 'ping' }
): ThunkAction<Promise<{ unsubscribe: () => void; conversationId: string }>, RootState, unknown, AnyAction> {
    return (dispatch, getState) => {
        const { status, webSocket }: any = getLifeLine(getState()) || {}
        if (webSocket && status === 'CONNECTED') {
            const conversationId = (payload as { conversationId?: string }).conversationId ?? uuidv4()
            const RequestId = payload.RequestId ?? uuidv4()
            let closed = false
            const cleanup = () => {
                if (closed) {
                    return
                }
                closed = true
                LifeLinePubSub.unsubscribe(subscriptionId)
            }
            const subscriptionId = LifeLinePubSub.subscribe(({ payload: incoming }) => {
                if (closed) {
                    return
                }
                if (!matchesCorrelationPayload(incoming, {
                    conversationId,
                    requestId: RequestId,
                    matchRequestIdFallback,
                })) {
                    return
                }
                if (incoming.messageType === 'Error' && 'error' in incoming && incoming.error) {
                    dispatch(push((incoming as { error: string }).error))
                }
                onEvent(incoming)
                if (isTerminal(incoming)) {
                    onTerminal?.(incoming)
                    cleanup()
                }
            })
            webSocket.send(JSON.stringify({
                service,
                ...payload,
                RequestId,
                conversationId,
            }))
            return Promise.resolve({
                conversationId,
                unsubscribe: cleanup,
            })
        }
        return Promise.reject({
            message: (payload as { message?: string }).message,
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

export const parseCommand = (CharacterId: EphemeraCharacterId) => ({ mode, entry, commandDispatchStrategy = 'fireAndForget' }: ParseCommandProps): ThunkAction<boolean, RootState, unknown, AnyAction> => (dispatch) => {
    if (mode === 'Command') {
        if (commandDispatchStrategy === 'promise') {
            // Optional correlation mode for command submissions. socketDispatchPromise adds RequestId.
            dispatch(socketDispatchPromise({ message: 'command', CharacterId, command: entry }))
        }
        else {
            dispatch(socketDispatch({ message: 'command', CharacterId, command: entry }))
        }
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