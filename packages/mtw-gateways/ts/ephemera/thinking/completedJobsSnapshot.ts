import type {
    ThinkingCompletedJobsSnapshot,
    ThinkingJobCompletedEvent,
} from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { THINKING_SCHEMA_VERSION_INITIAL } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import type { EphemeraThinkingReadDB, EphemeraThinkingReadDBQueryPage, ThinkingJobReadSnapshot } from './fetch'
import { fetchThinkingJobSnapshot } from './fetch'
import { jobMetaDataCategory, parseGenerationIdFromJobEphemeraId } from './keys'
import { thinkingSnapshotCompletedCutoffIso } from './retention'

const isQueryPage = <Row extends Record<string, unknown>>(
    value: Row[] | EphemeraThinkingReadDBQueryPage<Row>
): value is EphemeraThinkingReadDBQueryPage<Row> =>
    !Array.isArray(value) && typeof value === 'object' && value !== null && 'items' in value

/**
 * List `generationId` values for jobs whose `Meta::Job` row has `jobStatus: completed`.
 *
 * Uses `DataCategoryIndex` (eventually consistent). Follow with `fetchThinkingJobSnapshot` per id
 * for strongly consistent per-job bodies.
 */
export const queryCompletedJobGenerationIds = async (db: EphemeraThinkingReadDB): Promise<string[]> => {
    const generationIds: string[] = []
    let nextToken: string | undefined

    do {
        const result = await db.query({
            IndexName: 'DataCategoryIndex',
            Key: { DataCategory: jobMetaDataCategory() },
            FilterExpression: 'jobStatus = :completed AND completedAt > :cutoff',
            ExpressionAttributeValues: {
                ':completed': 'completed',
                ':cutoff': thinkingSnapshotCompletedCutoffIso(),
            },
            allFields: true,
            pagination: nextToken ? { nextToken } : true,
        })

        const page = isQueryPage(result) ? result : { items: result, nextToken: undefined }
        for (const row of page.items) {
            if (typeof row.EphemeraId !== 'string') {
                continue
            }
            const generationId = parseGenerationIdFromJobEphemeraId(row.EphemeraId)
            if (generationId) {
                generationIds.push(generationId)
            }
        }
        nextToken = page.nextToken
    } while (nextToken)

    return generationIds
}

/**
 * Map a job read snapshot to a subscribe/stream `Job Completed` payload, or null when not publishable.
 */
export const thinkingJobReadSnapshotToCompletedEvent = (
    snapshot: ThinkingJobReadSnapshot
): ThinkingJobCompletedEvent | null => {
    if (snapshot.jobStatus !== 'completed' || !snapshot.completedAt || snapshot.schedules.length === 0) {
        return null
    }
    const schemaVersion = snapshot.schemaVersion ?? THINKING_SCHEMA_VERSION_INITIAL
    return {
        schemaVersion,
        generationId: snapshot.generationId,
        jobStatus: 'completed',
        completedAt: snapshot.completedAt,
        schedules: snapshot.schedules,
    }
}

const replayAtFromCompletedJobs = (completedJobs: ThinkingJobCompletedEvent[]): number => {
    if (completedJobs.length === 0) {
        return 0
    }
    return completedJobs.reduce((maxMs, job) => {
        const ms = Date.parse(job.completedAt)
        return Number.isFinite(ms) ? Math.max(maxMs, ms) : maxMs
    }, 0)
}

/**
 * Subscribe-time snapshot for `mtw.ephemera.thinking.scheduling` streamKey `global`.
 * Loads completed jobs from authoritative Dynamo via consistent per-job reads; sets `replayAt`
 * so replay delivers only `Job Completed` stream events after the snapshot watermark.
 */
export const buildThinkingCompletedJobsSnapshot = async (
    db: EphemeraThinkingReadDB
): Promise<ThinkingCompletedJobsSnapshot & { replayAt: number }> => {
    const generationIds = await queryCompletedJobGenerationIds(db)
    const snapshots = await Promise.all(
        generationIds.map((generationId) => fetchThinkingJobSnapshot(db, generationId))
    )
    const completedJobs = snapshots
        .map((snapshot) => thinkingJobReadSnapshotToCompletedEvent(snapshot))
        .filter((event): event is ThinkingJobCompletedEvent => event !== null)

    return {
        completedJobs,
        replayAt: replayAtFromCompletedJobs(completedJobs),
    }
}
