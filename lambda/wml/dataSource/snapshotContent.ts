/**
 * mtw.wml DataSource snapshot content generation.
 *
 * Bridges DynamoDB (DataSource-specific) with S3 Storage (WML domain): queries Dynamo
 * for events newer than the current snapshot, decides whether to create an S3 snapshot,
 * then delegates to S3 Storage for presigning. Co-located with dataSource since it
 * drives the Dynamo query and orchestration.
 *
 * Flow: Dynamo-first (Meta::Snapshot.createdAt + event query), with manifest fallback
 * when manifest has chunks that Dynamo does not record (e.g. edits before replayable).
 */

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import assetDB from '../utilities/mockableAssetDB'
import { getPresignedSnapshotUrl } from '../s3Storage/snapshotPresign'
import { getChunksAfterLatestSnapshot } from '../s3Storage/manifest'
import { buildPrefix } from '../s3Storage/tools'

const DATA_SOURCE_KEY = 'mtw.wml'
const PRIMARY_KEY_NAME = 'AssetId'

/**
 * Load the latest snapshot timestamp from Dynamo Meta::Snapshot.
 * Returns 0 if no snapshot exists.
 */
async function getLatestSnapshotTimestampFromDynamo(assetId: AssetUUID): Promise<number> {
    const primaryKey = `STREAM#${DATA_SOURCE_KEY}::${assetId}`
    const result = await assetDB.getItem<{ snapshotHeader?: { timestamp?: number } }>({
        Key: { [PRIMARY_KEY_NAME]: primaryKey, DataCategory: 'Meta::Snapshot' },
        ProjectionFields: ['snapshotHeader']
    })
    const timestamp = result?.snapshotHeader?.timestamp
    return typeof timestamp === 'number' ? timestamp : 0
}

/**
 * Generate domain-shaped snapshot content for mtw.wml DataSource.
 * Dynamo-first: loads Meta::Snapshot.createdAt, queries Dynamo for events since then.
 * Fallback: when Dynamo has no events but manifest has chunks, creates snapshot and logs mismatch.
 *
 * @param assetId - Asset UUID (same as streamKey for mtw.wml)
 * @returns Domain-shaped payload plus authoritative replay watermark
 */
export async function generateWmlSnapshotContent(
    assetId: AssetUUID
): Promise<{ wml: { sidecarUrl: string }, replayAt: number }> {
    const replayAtQueryBound = await getLatestSnapshotTimestampFromDynamo(assetId)

    const primaryKey = `STREAM#${DATA_SOURCE_KEY}::${assetId}`
    const dynamoEvents = await assetDB.query<{ AssetId: string; DataCategory: string }>({
        Key: { [PRIMARY_KEY_NAME]: primaryKey },
        KeyConditionExpression: 'DataCategory BETWEEN :timestampPrefix AND :timestampEndRange',
        ExpressionAttributeValues: {
            ':timestampPrefix': `EVENT#${replayAtQueryBound}`,
            ':timestampEndRange': 'EVENT#99999999'
        },
        allFields: true
    })

    let createSnapshotFirst = Array.isArray(dynamoEvents) && dynamoEvents.length > 0

    if (!createSnapshotFirst) {
        const manifestChunksCount = await getChunksAfterLatestSnapshot(buildPrefix(assetId, 'wml'))
        if (manifestChunksCount > 0) {
            console.warn(
                `mtw.wml snapshot mismatch: Dynamo has no events but manifest has ${manifestChunksCount} chunks after snapshot for ${assetId}. Creating snapshot.`
            )
            createSnapshotFirst = true
        }
    }

    const { snapshotTimestamp, ...snapshotContent } = await getPresignedSnapshotUrl(assetId, createSnapshotFirst)
    return {
        ...snapshotContent,
        replayAt: snapshotTimestamp
    }
}
