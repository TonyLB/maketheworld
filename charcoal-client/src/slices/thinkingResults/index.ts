import { AnyAction, ThunkAction } from '@reduxjs/toolkit'

import { RootState } from '../../store'
import { PromiseCache } from '../promiseCache'
import { multipleSSM } from '../stateSeekingMachine/multipleSSM'
import { heartbeat } from '../stateSeekingMachine/ssmHeartbeat'
import type { ThinkingWorkItemId } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import { ThinkingResultsData, ThinkingResultsNodes } from './baseClasses'
import {
    backoffAction,
    fetchThinkingResultAction,
    lifelineCondition
} from './index.api'
import { publicSelectors, PublicSelectors } from './selectors'

const thinkingResultsPromiseCache = new PromiseCache<ThinkingResultsData>()

export const {
    slice: thinkingResultsSlice,
    selectors,
    iterateAllSSMs
} = multipleSSM<ThinkingResultsNodes, PublicSelectors>({
    name: 'thinkingResults',
    initialSSMState: 'INITIAL',
    initialSSMDesired: ['READY'],
    promiseCache: thinkingResultsPromiseCache,
    initialData: {
        internalData: {
            incrementalBackoff: 0.5
        },
        publicData: {}
    },
    sliceSelector: ({ thinkingResults }) => thinkingResults,
    publicSelectors,
    template: {
        initialState: 'INITIAL',
        initialData: {
            internalData: {
                incrementalBackoff: 0.5
            },
            publicData: {}
        },
        states: {
            INITIAL: {
                stateType: 'HOLD',
                next: 'INACTIVE',
                condition: lifelineCondition
            },
            INACTIVE: {
                stateType: 'CHOICE',
                choices: ['FETCH']
            },
            FETCH: {
                stateType: 'ATTEMPT',
                action: fetchThinkingResultAction,
                resolve: 'READY',
                reject: 'ERROR'
            },
            FETCHBACKOFF: {
                stateType: 'ATTEMPT',
                action: backoffAction,
                resolve: 'FETCH',
                reject: 'ERROR'
            },
            READY: {
                stateType: 'CHOICE',
                choices: []
            },
            ERROR: {
                stateType: 'CHOICE',
                choices: []
            }
        }
    }
})

export const { addItem, setIntent } = thinkingResultsSlice.actions

export const {
    getThinkingResult,
    getThinkingResultError,
    getStatus: getThinkingResultMachineStatus,
    getError: getThinkingResultMachineError
} = selectors

export const getThinkingResultDisplayError = (workItemId: string): ((state: RootState) => string | undefined) => (state) => {
    const publicError = getThinkingResultError(workItemId)(state)
    if (publicError) {
        return publicError
    }
    const machineError = getThinkingResultMachineError(workItemId)(state) as { error?: string; message?: string }
    if (machineError?.error) {
        return machineError.error
    }
    if (machineError?.message) {
        return machineError.message
    }
    return undefined
}

export type ThinkingResultFetchState = 'loading' | 'ready' | 'error'

export const getThinkingResultFetchState = (workItemId: string): ((state: RootState) => ThinkingResultFetchState | undefined) => (state) => {
    const status = getThinkingResultMachineStatus(workItemId)(state)
    if (!status) {
        return undefined
    }
    if (status === 'READY') {
        return 'ready'
    }
    if (status === 'ERROR') {
        return 'error'
    }
    return 'loading'
}

export const requestThinkingResult = (workItemId: ThinkingWorkItemId): ThunkAction<void, RootState, unknown, AnyAction> => (dispatch) => {
    dispatch(addItem({ key: workItemId }))
    dispatch(setIntent({ key: workItemId, intent: ['READY'] }))
    dispatch(heartbeat)
}

export default thinkingResultsSlice.reducer
