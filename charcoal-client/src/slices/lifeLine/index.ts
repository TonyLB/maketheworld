import { LifeLineData, LifeLineNodes } from './baseClasses'
import { singleSSM } from '../stateSeekingMachine/singleSSM'
import {
    subscribeMessages,
    establishWebSocket,
    disconnectWebSocket,
    backoffAction,
    unsubscribeMessages
} from './index.api'
import { PromiseCache } from '../promiseCache'
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
    iterateAllSSMs
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
    publicReducers: {},
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
                stateType: 'CHOICE',
                choices: ['SUBSCRIBE']
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
                choices: []
            },
            STALE: {
                stateType: 'CHOICE',
                choices: ['CONNECT']
            }
        }
    }
})

// export const { } = publicActions
export const {
    getStatus
} = selectors

export default lifeLineSlice.reducer
