import { buildThinkingCompletedJobsSnapshot } from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import type { ThinkingCompletedJobsSnapshot } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

/**
 * Subscribe-time snapshot for streamKey `global`.
 * Authoritative completed jobs from Dynamo; `replayAt` limits replay to newer stream events.
 */
export const generateThinkingCompletedJobsSnapshot = async (
    _streamKey: string
): Promise<ThinkingCompletedJobsSnapshot & { replayAt: number }> =>
    buildThinkingCompletedJobsSnapshot(ephemeraDB)
