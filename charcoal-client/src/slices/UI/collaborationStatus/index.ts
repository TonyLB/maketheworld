import { singleSSM } from '../../stateSeekingMachine/singleSSM'
import { CollaborationStatusNodes, CollaborationStatusInternal, CollaborationStatusPublic } from './baseClasses'
import { lifelineCondition, fetchCollaborationStatus, backoffAction } from './index.api'
import { publicSelectors } from './selectors'
import { PromiseCache } from '../../promiseCache'

const promiseCache = new PromiseCache<{ internalData: CollaborationStatusInternal; publicData: CollaborationStatusPublic }>()

export const {
    slice: collaborationStatusSlice,
    selectors,
    publicActions,
    iterateAllSSMs
} = singleSSM<CollaborationStatusNodes, typeof publicSelectors>({
    name: 'collaborationStatus',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['SUCCESS'],
    initialData: {
        internalData: {
            incrementalBackoff: 0.5,
            error: undefined
        },
        publicData: {
            status: undefined,
            loading: false
        }
    },
    sliceSelector: (state: any) => state.UI.collaborationStatus,
    publicReducers: {},
    publicSelectors,
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5,
                error: undefined
            },
            publicData: {
                status: undefined,
                loading: false
            }
        },
        states: {
            INITIAL: {
                stateType: 'CHOICE',
                choices: ['WAIT_FOR_CONNECTION']
            },
            WAIT_FOR_CONNECTION: {
                stateType: 'HOLD' as const,
                condition: lifelineCondition,
                next: 'FETCHING'
            },
            FETCHING: {
                stateType: 'ATTEMPT',
                action: fetchCollaborationStatus,
                resolve: 'SUCCESS',
                reject: 'ERROR'
            },
            SUCCESS: {
                stateType: 'CHOICE',
                choices: []
            },
            ERROR: {
                stateType: 'CHOICE',
                choices: ['BACKOFF']
            },
            BACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'FETCHING',
                reject: 'ERROR'
            }
        }
    },
    promiseCache
})

export default collaborationStatusSlice.reducer
