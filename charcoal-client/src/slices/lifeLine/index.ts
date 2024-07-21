import { LifeLineData, LifeLineNodes } from './baseClasses'
import { singleSSM } from '../stateSeekingMachine/singleSSM'
import {
    subscribeMessages,
    establishWebSocket,
    disconnectWebSocket,
    backoffAction,
    unsubscribeMessages,
    refreshTokenCondition
} from './index.api'
import { PromiseCache } from '../promiseCache'
import { PayloadAction } from '@reduxjs/toolkit'
export {
    socketDispatch,
    socketDispatchPromise,
    apiDispatchPromise,
    moveCharacter,
    parseCommand,
    LifeLinePubSub
} from './index.api'

const lifeLinePromiseCache = new PromiseCache<LifeLineData>()

export const {
    slice: lifeLineSlice,
    selectors,
    publicActions,
    iterateAllSSMs,
} = singleSSM<LifeLineNodes, {}>({
    name: 'lifeLine',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['CONNECTED'],
    promiseCache: lifeLinePromiseCache,
    initialData: {
        internalData: {
            incrementalBackoff: 0.5,
            pingInterval: null,
            refreshTimeout: null,
            messageSubscription: null,
            notificationSubscription: null
        },
        publicData: {
            webSocket: null
        }
    },
    sliceSelector: ({ lifeLine }) => (lifeLine),
    publicReducers: {
        receiveIDToken: (state, action: PayloadAction<string | undefined>) => {
            state.IDToken = action.payload
        }
    },
    publicSelectors: {},
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5,
                pingInterval: null,
                refreshTimeout: null,
                messageSubscription: null,
                notificationSubscription: null
            },
            publicData: {
                webSocket: null
            }
        },
        states: {
            INITIAL: {
                stateType: 'HOLD',
                next: 'SUBSCRIBE',
                condition: refreshTokenCondition
            },
            SUBSCRIBE: {
                stateType: 'ATTEMPT',
                action: subscribeMessages,
                resolve: 'CONNECT',
                reject: 'ERROR'
            },
            CONNECT: {
                stateType: 'ATTEMPT',
                action: establishWebSocket,
                resolve: 'CONNECTED',
                reject: 'ERROR'
            },
            CONNECTBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'CONNECT',
                reject: 'ERROR'
            },
            CONNECTED: {
                stateType: 'CHOICE',
                choices: ['SIGNOUT', 'STALE']
            },
            SIGNOUT: {
                stateType: 'REDIRECT',
                newIntent: ['CONNECTED'],
                choices: ['DISCONNECT']
            },
            DISCONNECT: {
                stateType: 'ATTEMPT',
                action: disconnectWebSocket,
                resolve: 'UNSUBSCRIBE',
                reject: 'ERROR'
            },
            UNSUBSCRIBE: {
                stateType: 'ATTEMPT',
                action: unsubscribeMessages,
                resolve: 'INITIAL',
                reject: 'ERROR'
            },
            ERROR: {
                stateType: 'CHOICE',
                choices: ['SIGNOUT']
            },
            STALE: {
                stateType: 'REDIRECT',
                newIntent: ['CONNECTED'],
                choices: ['RECONNECT']
            },
            RECONNECT: {
                stateType: 'CHOICE',
                choices: ['CONNECT']
            }
        }
    }
})

export const {
    getStatus
} = selectors

export const {
    onEnter,
    receiveIDToken
} = publicActions

export const { setIntent } = lifeLineSlice.actions

export default lifeLineSlice.reducer
