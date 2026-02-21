/**
 * mtw.wml DataSource snapshot content generation.
 *
 * Bridges DynamoDB (DataSource-specific) with S3 Storage (WML domain): queries Dynamo
 * for events newer than the current snapshot, decides whether to create an S3 snapshot,
 * then delegates to S3 Storage for presigning. Co-located with dataSource since it
 * drives the Dynamo query and orchestration.
 */

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import assetDB from '../utilities/mockableAssetDB'
import { getLatestSnapshotTimestamp, getPresignedSnapshotUrl } from '../s3Storage/snapshotPresign'

const DATA_SOURCE_KEY = 'mtw.wml'
const PRIMARY_KEY_NAME = 'AssetId'

/**
 * Generate domain-shaped snapshot content for mtw.wml DataSource.
 * Dynamo-driven: queries Dynamo for events newer than manifest snapshot; when any exist,
 * requests S3 Storage to create a snapshot. Always presigns the newest S3 snapshot.
 *
 * @param assetId - Asset UUID (same as streamKey for mtw.wml)
 * @returns Domain-shaped payload { wml: { sidecarUrl } }
 */
export async function generateWmlSnapshotContent(
    assetId: AssetUUID
): Promise<{ wml: { sidecarUrl: string } }> {
    const sinceTimestamp = await getLatestSnapshotTimestamp(assetId)

    const primaryKey = `STREAM#${DATA_SOURCE_KEY}::${assetId}`
    const dynamoEvents = await assetDB.query<{ AssetId: string; DataCategory: string }>({
        Key: { [PRIMARY_KEY_NAME]: primaryKey },
        KeyConditionExpression: 'DataCategory BETWEEN :timestampPrefix AND :timestampEndRange',
        ExpressionAttributeValues: {
            ':timestampPrefix': `EVENT#${sinceTimestamp}`,
            ':timestampEndRange': 'EVENT#99999999'
        },
        allFields: true
    })

    const createSnapshotFirst = Array.isArray(dynamoEvents) && dynamoEvents.length > 0

    return getPresignedSnapshotUrl(assetId, createSnapshotFirst)
}
