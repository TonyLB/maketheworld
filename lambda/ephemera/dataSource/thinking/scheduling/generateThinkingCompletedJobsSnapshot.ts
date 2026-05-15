import type { ThinkingCompletedJobsSnapshot } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

/**
 * Subscribe-time snapshot for streamKey `global`.
 * MVP returns an empty list; replay of stored Job Completed events supplies history after subscribe.
 */
export const generateThinkingCompletedJobsSnapshot = async (
    _streamKey: string
): Promise<ThinkingCompletedJobsSnapshot> => ({
    completedJobs: [],
})
