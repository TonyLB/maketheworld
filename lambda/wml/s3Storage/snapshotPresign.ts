/**
 * S3 Storage snapshot presigning for WML content.
 *
 * Operates purely on the manifest-and-chunks S3 storage: loads manifest,
 * optionally creates a snapshot, presigns the newest S3 snapshot, returns
 * a domain-shaped sidecar descriptor. No DynamoDB or DataSource awareness.
 */

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { buildPrefix } from './tools'
import { loadManifest } from './manifest'
import { isManifestSnapshotEvent, ManifestSnapshotEvent } from './manifest/baseClasses'
import { createManualSnapshot } from './manifest/orchestration'
import AssetWorkspace from './AssetWorkspace'

const S3_BUCKET = process.env.S3_BUCKET ?? 'Test'
const PRESIGN_EXPIRY_SECONDS = 1800 // 30 minutes

const parseManifestSnapshotTimestamp = (event: ManifestSnapshotEvent): number =>
    Date.parse(event.timestamp) || 0

/**
 * Get the timestamp (ms) of the latest snapshot in the manifest for an asset.
 * Returns 0 if no snapshot exists.
 */
export async function getLatestSnapshotTimestamp(assetId: AssetUUID): Promise<number> {
    const prefix = buildPrefix(assetId, 'wml')
    const events = await loadManifest(prefix)
    const snapshotEvents = events.filter(isManifestSnapshotEvent)
    const latest = snapshotEvents.length > 0 ? snapshotEvents[snapshotEvents.length - 1] : undefined
    return latest ? parseManifestSnapshotTimestamp(latest) : 0
}

/**
 * Presign the newest S3 snapshot and return a domain-shaped payload plus manifest mint time.
 * If createSnapshotFirst is true, creates a new snapshot via createManualSnapshot first,
 * reloads the manifest, then presigns the newest snapshot row.
 *
 * snapshotTimestamp is the manifest event time (ms) for the same snapshot whose s3Key
 * was presigned, including a row minted by createManualSnapshot on this call.
 *
 * @param assetId - Asset UUID
 * @param createSnapshotFirst - Whether to call createManualSnapshot before presigning
 * @returns Domain-shaped { wml: { sidecarUrl }, snapshotTimestamp }
 * @throws If no snapshot exists or the S3 object does not exist
 */
export async function getPresignedSnapshotUrl(
    assetId: AssetUUID,
    createSnapshotFirst: boolean
): Promise<{ wml: { sidecarUrl: string }; snapshotTimestamp: number }> {
    const prefix = buildPrefix(assetId, 'wml')
    const assetKey = assetId.replace('ASSET#', '')

    let events = await loadManifest(prefix)

    if (createSnapshotFirst) {
        const assetWorkspace = await AssetWorkspace.fromUUID(assetId)
        if (!assetWorkspace) {
            throw new Error(`Asset ${assetId} not found; cannot create snapshot`)
        }
        await createManualSnapshot({
            prefix: `${assetKey}.wml/`,
            zone: assetWorkspace.zone
        })
        events = await loadManifest(prefix)
    }

    const snapshotEvents = events.filter(isManifestSnapshotEvent)
    const newestSnapshot = snapshotEvents.length > 0 ? snapshotEvents[snapshotEvents.length - 1] : undefined

    if (!newestSnapshot) {
        throw new Error(`No snapshot found for asset ${assetId} (asset may not exist)`)
    }

    const exists = await s3Client.check({ Key: newestSnapshot.s3Key })
    if (!exists) {
        throw new Error(`Sidecar snapshot object not found: ${newestSnapshot.s3Key} (asset may not exist)`)
    }

    const getCommand = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: newestSnapshot.s3Key
    })
    const sidecarUrl = await getSignedUrl(s3Client.internalClient as any, getCommand as any, {
        expiresIn: PRESIGN_EXPIRY_SECONDS
    })

    const snapshotTimestamp = parseManifestSnapshotTimestamp(newestSnapshot)

    return { wml: { sidecarUrl }, snapshotTimestamp }
}
