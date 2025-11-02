import { schemaToWML } from '@tonylb/mtw-wml/ts/schema/index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import ReadOnlyAssetWorkspace, { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { deepEqual } from '@tonylb/mtw-asset-workspace/ts/objects'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

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

}

export default AssetWorkspace

