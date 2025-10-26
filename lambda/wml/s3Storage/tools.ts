/**
 * S3 Storage Utilities
 * 
 * Low-level helper functions used by multiple operations.
 * These are simple, focused utilities with no opinions about operations.
 */

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * Manifest suffix for content vs authorization files
 * Matches the file types used by AssetWorkspace.s3KeyFor()
 */
export type ManifestSuffix = 'wml' | 'auth.wml'

/**
 * Build S3 prefix from assetId and suffix
 * 
 * @param assetId - Asset UUID (e.g., 'ASSET#test')
 * @param suffix - Manifest suffix ('wml' or 'auth.wml')
 * @returns S3 prefix (e.g., 'test.wml/' or 'test.auth.wml/')
 * 
 * @example
 * ```typescript
 * buildPrefix('ASSET#my-room', 'wml')
 * // Returns: 'my-room.wml/'
 * 
 * buildPrefix('ASSET#my-room', 'auth.wml')
 * // Returns: 'my-room.auth.wml/'
 * ```
 */
export function buildPrefix(assetId: AssetUUID, suffix: ManifestSuffix): string {
    const baseId = assetId.replace('ASSET#', '')
    return `${baseId}.${suffix}/`
}

