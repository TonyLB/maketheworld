/**
 * Asset Workspace - Read-Only Package
 * 
 * This package provides read-only access to S3-stored assets.
 * 
 * WRITE OPERATIONS: Writable AssetWorkspace has been moved to lambda/wml/AssetWorkspace.ts
 * to enforce that only the WML lambda has write authority over S3 storage.
 * 
 * If you need write access to assets, you should be working in the wml lambda.
 */

import ReadOnlyAssetWorkspace from "./readOnly"

export { Zone } from './readOnly'
export { ReadOnlyAssetWorkspace }
export default ReadOnlyAssetWorkspace
