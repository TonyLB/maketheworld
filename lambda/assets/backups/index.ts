import { EphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"

type CreateEntryArgs = {
    AssetId: EphemeraAssetId;
}

/**
 * Phase 1B: Stubbed out for Phase 2 S3 refactor
 * 
 * Backup functionality will be completely redesigned in Phase 2
 * to work with the new flat UUID-based storage architecture.
 * 
 * This stub exists to maintain API compatibility with existing
 * Step Functions and app.ts handlers during the transition.
 */
export const createBackupEntry = async ({ AssetId }: CreateEntryArgs): Promise<{ 
    suffix: string; 
    assetId: EphemeraAssetId;
    backupId: `BACKUP#${string}`; 
    fileName: string 
}> => {
    throw new Error('Backup functionality temporarily disabled during Phase 1B migration. Will be reimplemented in Phase 2.')
}
