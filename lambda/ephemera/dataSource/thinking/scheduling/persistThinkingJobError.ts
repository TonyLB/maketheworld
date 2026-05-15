import { jobEphemeraId, jobMetaDataCategory } from '@tonylb/mtw-gateways/ts/ephemera/thinking'
import type { ThinkingJobErrorEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { isThinkingJobErrorEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export type PersistThinkingJobErrorOutcome = 'written' | 'invalidPayload'

/** Dynamo row shape for `Meta::Job` optimistic merge (subset of persisted fields). */
type ThinkingMetaJobRow = {
    EphemeraId?: string;
    DataCategory?: string;
    generationId?: string;
    jobStatus?: string;
    schemaVersion?: number;
    createdAt?: string;
    failedAt?: string;
    errorCode?: string;
    errorMessage?: string;
    lastFailedWorkItemId?: string;
}

const metaJobKey = (generationId: string) => ({
    EphemeraId: jobEphemeraId(generationId),
    DataCategory: jobMetaDataCategory(),
})

function jobErrorUpdateKeys(event: ThinkingJobErrorEvent): string[] {
    const keys = ['jobStatus', 'failedAt', 'schemaVersion']
    if (event.errorCode !== undefined) {
        keys.push('errorCode')
    }
    if (event.errorMessage !== undefined) {
        keys.push('errorMessage')
    }
    if (event.lastFailedWorkItemId !== undefined) {
        keys.push('lastFailedWorkItemId')
    }
    return keys
}

/**
 * Run-level failure on `Meta::Job`. Expects **Put Thinking Job Create** to have run first for this
 * `generationId`. Uses **`optimisticUpdate`** so concurrent writers retry on conflict. If the row is
 * missing, no-ops without writing a partial item.
 */
export async function persistThinkingJobError(payload: unknown): Promise<PersistThinkingJobErrorOutcome> {
    if (!isThinkingJobErrorEvent(payload)) {
        return 'invalidPayload'
    }
    const event = payload

    const key = metaJobKey(event.generationId)
    const existing = await ephemeraDB.getItem<ThinkingMetaJobRow>({
        Key: key,
        getAllFields: true,
    })
    if (!existing?.generationId) {
        return 'written'
    }

    await ephemeraDB.optimisticUpdate({
        Key: key,
        priorFetch: existing,
        updateKeys: jobErrorUpdateKeys(event),
        updateReducer: (draft) => {
            draft.jobStatus = event.jobStatus
            draft.failedAt = event.failedAt
            draft.schemaVersion = event.schemaVersion
            if (event.errorCode !== undefined) {
                draft.errorCode = event.errorCode
            }
            if (event.errorMessage !== undefined) {
                draft.errorMessage = event.errorMessage
            }
            if (event.lastFailedWorkItemId !== undefined) {
                draft.lastFailedWorkItemId = event.lastFailedWorkItemId
            }
        },
    })
    return 'written'
}
