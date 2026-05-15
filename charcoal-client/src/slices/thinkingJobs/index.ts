// ThinkingJobs DataSource Slice
//
// Subscribes to mtw.ephemera.thinking.scheduling (streamKey global) for Job Completed events.

import { createDataSourceSlice } from '../dataSource'
import {
    ThinkingJobsAggregator,
    ThinkingEventSerializer,
    ThinkingJobCompletedEvent
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

export const {
    slice: thinkingJobsSlice,
    selectors: thinkingJobsSelectors,
    publicActions: thinkingJobsActions,
    iterateAllSSMs: iterateThinkingJobs,
    subscribeToStreams: subscribeToThinkingJobsStreams,
    unsubscribeFromStreams: unsubscribeFromThinkingJobsStreams
} = createDataSourceSlice({
    name: 'thinkingJobs',
    dataSourceKey: 'mtw.ephemera.thinking.scheduling',
    aggregator: new ThinkingJobsAggregator(),
    eventSerializer: new ThinkingEventSerializer(),
    sliceSelector: (state: any) => state.thinkingJobs
})

export const subscribeToThinkingJobs = () => subscribeToThinkingJobsStreams(['global'])

export const unsubscribeFromThinkingJobs = () => unsubscribeFromThinkingJobsStreams(['global'])

export const {
    getActiveStreamKeys,
    getSubscribedStreams
} = thinkingJobsSelectors

export const {
    processEnvelope
} = thinkingJobsActions

export const getCompletedThinkingJobs = (state: any): ThinkingJobCompletedEvent[] => {
    const streams = thinkingJobsSelectors.getSubscribedStreams(state)
    const globalStream = streams['global']
    return globalStream?.materializedView?.completedJobs ?? []
}

export const getIsThinkingJobsSubscribed = (state: any): boolean => {
    const activeStreamKeys = thinkingJobsSelectors.getActiveStreamKeys(state)
    return activeStreamKeys.includes('global')
}
