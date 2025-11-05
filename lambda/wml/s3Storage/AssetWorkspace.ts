import { schemaToWML } from '@tonylb/mtw-wml/ts/schema/index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import ReadOnlyAssetWorkspace, { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { deepEqual } from '@tonylb/mtw-asset-workspace/ts/objects'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3"

export { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'

/**
 * Writable AssetWorkspace for WML lambda
 * 
 * This class extends ReadOnlyAssetWorkspace with write capabilities for S3 storage.
 * It is intentionally scoped to the wml lambda to maintain clear authority boundaries
 * over S3 write operations.
 */
export class AssetWorkspace extends ReadOnlyAssetWorkspace {
    static override async fromUUID(assetId: AssetUUID, options?: {
        preferDynamo?: boolean
        allowS3Fallback?: boolean
    }): Promise<AssetWorkspace | undefined> {
        const readOnly = await ReadOnlyAssetWorkspace.fromUUID(assetId, options)
        if (!readOnly) {
            return undefined
        }
        return new AssetWorkspace(readOnly.assetId, readOnly.zone, readOnly.player)
    }

    get wml(): string | undefined {
        if (this.standard) {
            return schemaToWML([this.standard.schema])
        }
        return undefined
    }

    async setJSON(standardForm: StandardForm): Promise<void> {
        const finalStandardForm = standardForm.finalize()

        // Validate that the StandardForm's universalKey matches this workspace's assetId
        if (finalStandardForm.universalKey !== this.assetId) {
            throw new Error(`Cannot set StandardForm with universalKey ${finalStandardForm.universalKey} on AssetWorkspace bound to ${this.assetId}`)
        }

        if (!(this.standard && deepEqual(finalStandardForm.toJSON(), this.standard.toJSON()))) {
            this.status.json = 'Dirty'
            this.status.wml = 'Dirty'
            this.standard = finalStandardForm
        }

    }

    //
    // TODO: Refactor tokenizer, parser, and schema to accept generators, then make setWML capable of
    // reading in a stream, and processing it as it arrives
    //
    async setWML(source: string): Promise<void> {
        const standard = new StandardForm(source)
        await this.setJSON(standard)
    }

    async setAuthorizationWML(source: string): Promise<void> {
        const authorizations = new StandardAuthorizationCollection(source)
        
        // Validate that the StandardAuthorizationCollection's universalKey matches this workspace's assetId
        if (authorizations.universalKey !== this.assetId) {
            throw new Error(`Cannot set StandardAuthorizationCollection with universalKey ${authorizations.universalKey} on AssetWorkspace bound to ${this.assetId}`)
        }
        
        this.authorizations = authorizations
    }

    async loadWML(): Promise<void> {
        const filePath = this.s3KeyFor('wml')
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.status.wml = 'Error'
                return
            }
            throw err
        }

        await this.setWML(contents)
        this.status.wml = 'Clean'
    }

    async loadAuthorizationWML(): Promise<void> {
        const filePath = this.s3KeyFor('auth.wml')
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.authStatus.wml = 'Error'
                return
            }
            throw err
        }

        const authorizations = new StandardAuthorizationCollection(contents)
        this.authorizations = authorizations
        this.authStatus.wml = 'Clean'
    }

    async loadWMLFrom(filePath: string, upload?: boolean): Promise<void> {
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath, upload })
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.status.wml = 'Error'
                return
            }
            throw err
        }

        await this.setWML(contents)
        this.status.wml = 'Clean'
    }

    override async loadJSON(): Promise<void> {
        await super.loadJSON()
    }

    async pushJSON(): Promise<void> {
        const filePath = this.s3KeyFor('json')
        const standardForm = this.standard || new StandardForm(this.assetId || 'ASSET#')
        const contents = JSON.stringify({
            assetId: this.assetId ?? '',
            standard: standardForm
        })
        
        // Phase 1: Add Zone tag to S3 objects
        const tags = { Zone: this.zone }
        const metadata = (this.zone === 'Personal' || this.zone === 'Draft') && this.player
            ? { player: this.player }
            : undefined
        
        await Promise.all([
            s3Client.putWithTags({
                Key: filePath,
                Body: contents,
                Tags: tags,
                Metadata: metadata
            }),
            s3Client.putWithTags({
                Key: this.s3KeyFor('ndjson'),
                Body: standardForm.toNDJSON().map((line) => (JSON.stringify(line))).join('\n'),
                Tags: tags,
                Metadata: metadata
            })
        ])
        this.status.json = 'Clean'
    }

    async pushAuthorizationJSON(): Promise<void> {
        const filePath = this.s3KeyFor('auth.ndjson')
        const contents = this.authorizations?.toNDJSON().map((line) => (JSON.stringify(line))).join('\n') || ''
        if (contents) {
            const tags = { Zone: this.zone }
            const metadata = (this.zone === 'Personal' || this.zone === 'Draft') && this.player
                ? { player: this.player }
                : undefined
            
            await s3Client.putWithTags({
                Key: filePath,
                Body: contents,
                Tags: tags,
                Metadata: metadata
            })
            this.authStatus.json = 'Clean'
        }
    }

    async pushWML(): Promise<void> {
        const filePath = this.s3KeyFor('wml')
        
        // Phase 1: Add Zone tag to S3 objects
        const tags = { Zone: this.zone }
        const metadata = (this.zone === 'Personal' || this.zone === 'Draft') && this.player
            ? { player: this.player }
            : undefined
        
        await s3Client.putWithTags({
            Key: filePath,
            Body: this.wml || '',
            Tags: tags,
            Metadata: metadata
        })
        this.status.wml = 'Clean'
    }

    async pushAuthorizationWML(): Promise<void> {
        if (this.authorizations) {
            const wml = schemaToWML([this.authorizations.schema])
            const filePath = this.s3KeyFor('auth.wml')
            
            const tags = { Zone: this.zone }
            const metadata = (this.zone === 'Personal' || this.zone === 'Draft') && this.player
                ? { player: this.player }
                : undefined
            
            await s3Client.putWithTags({
                Key: filePath,
                Body: wml,
                Tags: tags,
                Metadata: metadata
            })
            this.authStatus.wml = 'Clean'
            this.authStatus.json = 'Dirty'
        }
    }

    /**
     * List all S3 objects with a given prefix
     * 
     * Used for finding all files associated with this asset (manifests, chunks, snapshots).
     * Handles pagination automatically.
     * 
     * @param prefix - S3 prefix to search under
     * @returns Array of S3 keys
     */
    async listObjects(prefix: string): Promise<string[]> {
        const keys: string[] = []
        let continuationToken: string | undefined
        
        const { S3_BUCKET = 'Test' } = process.env
        
        do {
            const response = await s3Client.internalClient.send(new ListObjectsV2Command({
                Bucket: S3_BUCKET,
                Prefix: prefix,
                ContinuationToken: continuationToken
            }))
            
            if (response.Contents) {
                keys.push(...response.Contents.map(obj => obj.Key).filter((key): key is string => key !== undefined))
            }
            
            continuationToken = response.NextContinuationToken
        } while (continuationToken)
        
        return keys
    }

    /**
     * Delete multiple S3 objects in batch
     * 
     * Used for purging assets. Handles batching automatically (S3 limit is 1000 objects per request).
     * Multiple batches are executed in parallel for efficiency.
     * 
     * @param keys - Array of S3 keys to delete
     * @returns Number of objects successfully deleted
     */
    async deleteObjects(keys: string[]): Promise<number> {
        if (keys.length === 0) {
            return 0
        }
        
        const { S3_BUCKET = 'Test' } = process.env
        
        // S3 DeleteObjects supports up to 1000 keys per request
        // Create batches and execute in parallel
        const batches: string[][] = []
        for (let i = 0; i < keys.length; i += 1000) {
            batches.push(keys.slice(i, i + 1000))
        }
        
        const responses = await Promise.all(
            batches.map(batch => 
                s3Client.internalClient.send(new DeleteObjectsCommand({
                    Bucket: S3_BUCKET,
                    Delete: {
                        Objects: batch.map(Key => ({ Key }))
                    }
                }))
            )
        )
        
        // Sum up deleted counts from all batches
        return responses.reduce((total, response) => total + (response.Deleted?.length ?? 0), 0)
    }

}

export default AssetWorkspace

