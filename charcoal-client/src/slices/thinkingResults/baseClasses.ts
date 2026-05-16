import type { ThinkingResultEvent, ThinkingWorkItemId } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import {
    ISSMAttemptNode,
    ISSMChoiceNode,
    ISSMHoldNode,
    ISSMHoldCondition,
    ISSMDataLayout,
    ISSMDataReturn,
    ISSMAction
} from '../stateSeekingMachine/baseClasses'

export interface ThinkingResultsInternal {
    id?: ThinkingWorkItemId
    incrementalBackoff: number
}

export interface ThinkingResultsPublic {
    result?: ThinkingResultEvent
    fetchError?: string
}

export type ThinkingResultsData = {
    internalData: ThinkingResultsInternal
    publicData: ThinkingResultsPublic
}

export type ThinkingResultsRecord = ISSMDataLayout<ThinkingResultsInternal, ThinkingResultsPublic>
export type ThinkingResultsReturn = ISSMDataReturn<ThinkingResultsInternal, ThinkingResultsPublic>
export type ThinkingResultsAction = ISSMAction<ThinkingResultsInternal, ThinkingResultsPublic>
export type ThinkingResultsCondition = ISSMHoldCondition<ThinkingResultsInternal, ThinkingResultsPublic>

export interface ThinkingResultsNodes {
    INITIAL: ISSMHoldNode<ThinkingResultsInternal, ThinkingResultsPublic>
    INACTIVE: ISSMChoiceNode
    FETCH: ISSMAttemptNode<ThinkingResultsInternal, ThinkingResultsPublic>
    FETCHBACKOFF: ISSMAttemptNode<ThinkingResultsInternal, ThinkingResultsPublic>
    READY: ISSMChoiceNode
    ERROR: ISSMChoiceNode
}
