/**
 * Sidecar snapshot resolution for mtw.wml DataSource subscription init.
 *
 * Chooses the best S3 object to serve as the snapshot: when the latest manifest
 * snapshot is still current (no chunks after it), presign that immutable snapshot;
 * otherwise presign the materialized view. Returns a presigned GET URL and metadata.
 */

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { buildPrefix } from './tools'
import { loadManifest } from './manifest'
import { isManifestSnapshotEvent, isManifestChunkEvent } from './manifest/baseClasses'

const S3_BUCKET = process.env.S3_BUCKET ?? 'Test'
const PRESIGN_EXPIRY_SECONDS = 600 // 10 minutes

/**
 * Descriptor for the client: presigned URL and timestamps.
 * Matches SidecarSnapshotDescriptor from mtw-lambda-patterns.
 */
export interface SidecarSnapshotDescriptor {
    sidecarUrl: string
    createdAt: number
    expiresAt?: number
}

/**
 * Resolve the best S3 key for the sidecar (snapshot if current, else materialized view),
 * then generate a presigned GET URL.
 *
 * Option B: Prefer immutable snapshot when it represents current state (no chunks after it);
 * fall back to materialized view when there are edits after the latest snapshot or no snapshot.
 *
 * @param assetId - Asset UUID (same as streamKey for mtw.wml)
 * @returns Descriptor with sidecarUrl, createdAt, expiresAt
 * @throws If the chosen object does not exist (e.g. asset never written)
 */
export async function getSidecarSnapshotDescriptor(
    assetId: AssetUUID
): Promise<SidecarSnapshotDescriptor> {
    const prefix = buildPrefix(assetId, 'wml')
    const materializedViewKey = prefix.slice(0, -1) // e.g. "uuid.wml"

    const events = await loadManifest(prefix)

    const snapshotEvents = events.filter(isManifestSnapshotEvent)
    const latestSnapshot = snapshotEvents.length > 0 ? snapshotEvents[snapshotEvents.length - 1] : undefined
    const snapshotTimestamp = latestSnapshot?.timestamp

    const chunksAfterSnapshot = events
        .filter(isManifestChunkEvent)
        .filter((e) => !snapshotTimestamp || e.timestamp > snapshotTimestamp)

    const useSnapshot = Boolean(latestSnapshot && chunksAfterSnapshot.length === 0)
    const s3Key = useSnapshot ? latestSnapshot!.s3Key : materializedViewKey

    // createdAt: snapshot event timestamp (ms) or now for materialized view
    const createdAt = useSnapshot
        ? (Date.parse(latestSnapshot!.timestamp) || Date.now())
        : Date.now()

    const exists = await s3Client.check({ Key: s3Key })
    if (!exists) {
        throw new Error(`Sidecar snapshot object not found: ${s3Key} (asset may not exist)`)
    }

    const getCommand = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
    })
    const sidecarUrl = await getSignedUrl(s3Client.internalClient as any, getCommand as any, {
        expiresIn: PRESIGN_EXPIRY_SECONDS
    })

    const expiresAt = createdAt + PRESIGN_EXPIRY_SECONDS * 1000

    return {
        sidecarUrl,
        createdAt,
        expiresAt
    }
}
