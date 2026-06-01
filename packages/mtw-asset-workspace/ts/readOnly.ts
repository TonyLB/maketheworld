import { GetObjectCommand } from "@aws-sdk/client-s3"

import { StandardAsset } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import { AssetWorkspaceException } from "./errors"
import { s3Client } from "./clients"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { isStandardAuthorizationCollectionNDJSON, StandardAuthorizationCollection } from "@tonylb/mtw-wml/ts/standardize/authorization"
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"

const { S3_BUCKET = 'Test' } = process.env;

const DEFAULT_WML_CONTENT_TYPE = 'text/plain; charset=utf-8'
const DEFAULT_NDJSON_CONTENT_TYPE = 'application/x-ndjson; charset=utf-8'

type AssetWorkspaceStatusItem = 'Initial' | 'Clean' | 'Dirty' | 'Error'

type AssetWorkspaceStatus = {
    json: AssetWorkspaceStatusItem;
    wml: AssetWorkspaceStatusItem;
    s3Missing?: boolean;  // Track whether S3 object exists (undefined = not checked, true = missing, false = exists)
}

export type WorkspaceImageProperty = {
    fileName: string;
}

export type WorkspacePropertyItem = WorkspaceImageProperty

export type WorkspaceProperties = {
    [name: string]: WorkspacePropertyItem;
}

export type Zone = 'Canon' | 'Library' | 'Personal' | 'Draft' | 'Archive'

export class ReadOnlyAssetWorkspace {
    assetId: AssetUUID;
    zone: Zone;
    player?: string;
    status: AssetWorkspaceStatus = {
        json: 'Initial',
        wml: 'Initial'
    };
    authStatus: AssetWorkspaceStatus = {
        json: 'Initial',
        wml: 'Initial'
    };
    standard?: StandardForm;
    authorizations?: StandardAuthorizationCollection;
    
    constructor(assetId: AssetUUID, zone: Zone, player?: string) {
        if (!assetId) {
            throw new AssetWorkspaceException('AssetId is required')
        }
        if (!zone) {
            throw new AssetWorkspaceException('Zone is required')
        }
        if ((zone === 'Personal' || zone === 'Draft') && !player) {
            throw new AssetWorkspaceException('Player is required for Personal/Draft zones')
        }
        
        this.assetId = assetId
        this.zone = zone
        this.player = player
    }

    /**
     * Create ReadOnlyAssetWorkspace from UUID by fetching metadata
     * 
     * Fetches zone and player information from DynamoDB (Meta::Asset) with
     * S3 fallback (reading Zone tag and player metadata).
     * 
     */
    static async fromUUID(assetId: AssetUUID, options?: {
        preferDynamo?: boolean
        allowS3Fallback?: boolean
    }): Promise<ReadOnlyAssetWorkspace | undefined> {
        const { preferDynamo = true, allowS3Fallback = true } = options || {}
        
        // Try DynamoDB first if preferred
        if (preferDynamo) {
            try {
                const { zone, player } = (await assetDB.getItem<{ zone?: Zone; player?: string }>({
                    Key: {
                        AssetId: assetId,
                        DataCategory: 'Meta::Asset'
                    },
                    ProjectionFields: ['zone', 'player']
                })) || {}
                
                if (zone) {
                    return new ReadOnlyAssetWorkspace(assetId, zone, player)
                }
            } catch (error) {
                console.warn(`DynamoDB lookup failed for ${assetId}:`, error)
                // Fall through to S3 fallback if enabled
            }
        }
        
        // Try S3 fallback if enabled
        if (allowS3Fallback) {
            try {
                const fileName = assetId.replace('ASSET#', '')
                
                // Get Zone from S3 tags
                const tags = await s3Client.getTags({ Key: `${fileName}.wml` })
                const zone = tags?.Zone as Zone | undefined
                
                if (!zone) {
                    console.warn(`No Zone tag found for ${assetId}`)
                    return undefined
                }
                
                // Get player from S3 metadata (only for Personal/Draft)
                let player: string | undefined
                if (zone === 'Personal' || zone === 'Draft') {
                    const metadata = await s3Client.getMetadata({ Key: `${fileName}.wml` })
                    player = metadata?.player
                    
                    if (!player) {
                        console.warn(`No player metadata found for ${assetId} in ${zone} zone`)
                        return undefined
                    }
                }
                
                return new ReadOnlyAssetWorkspace(assetId, zone, player)
            } catch (error) {
                console.warn(`S3 fallback failed for ${assetId}:`, error)
                return undefined
            }
        }
        
        return undefined
    }

    get _isGlobal(): boolean {
        return (this.zone === 'Canon' && this.assetId === 'ASSET#primitives')
    }

    get s3Key(): string {
        return this.assetId.replace('ASSET#', '')
    }

    s3KeyFor(type: 'wml' | 'ndjson' | 'json' | 'auth.wml' | 'auth.ndjson'): string {
        return `${this.s3Key}.${type}`
    }

    //
    // forceDefault creates default empty draft files if they don't exist
    // Phase 1: Uses UUID-based naming with flat structure and Zone tags
    //
    async forceDefault(): Promise<void> {
        const Key = this.s3KeyFor('wml')
        const found = await s3Client.check({ Key })
        if (!found) {
            //
            // If no object exists, create default files for a draft asset
            // Note: assetId should already be set with the draft's UUID
            //
            const uuid = this.s3Key
            
            const tags = { Zone: this.zone }
            const metadata = this.zone === 'Personal' && this.player
                ? { player: this.player }
                : undefined
            
            await Promise.all([
                s3Client.putWithTags({
                    Key,
                    Body: `<Asset uuid=(${uuid}) />`,
                    Tags: tags,
                    Metadata: metadata,
                    ContentType: DEFAULT_WML_CONTENT_TYPE
                }),
                s3Client.putWithTags({
                    Key: this.s3KeyFor('ndjson'),
                    Body: `{"tag":"Asset","universalKey":"${this.assetId}"}`,
                    Tags: tags,
                    Metadata: metadata,
                    ContentType: DEFAULT_NDJSON_CONTENT_TYPE
                })
            ])
        }

    }
    
    async presignedURL(): Promise<string> {
        const getCommand = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: this.s3KeyFor('wml')
        })
        const presignedOutput = await getSignedUrl(s3Client.internalClient as any, getCommand as any, { expiresIn: 60 })
        return presignedOutput
    
    }

    async loadJSON() {
        const filePath = this.s3KeyFor('ndjson')
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
            this.status.s3Missing = false  // File exists
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.standard = new StandardForm(this.assetId)
                this.status.json = 'Clean'
                this.status.s3Missing = true  // File doesn't exist in S3
                return
            }
            throw err
        }
        
        const lines = contents.split('\n').map((line) => (JSON.parse(line)))
        this.standard = new StandardForm(lines)
        this.status.json = 'Clean'
    }

    async loadAuthorizationJSON() {
        const filePath = this.s3KeyFor('auth.ndjson')
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
            this.authStatus.s3Missing = false  // File exists
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.authorizations = new StandardAuthorizationCollection(this.assetId)
                this.authStatus.json = 'Clean'
                this.authStatus.s3Missing = true  // File doesn't exist in S3
                return
            }
            throw err
        }

        const lines = contents.split('\n').map((line) => (JSON.parse(line)))
        if (!lines.every(isStandardAuthorizationCollectionNDJSON)) {
            throw new AssetWorkspaceException('Invalid authorization JSON')
        }
        this.authorizations = new StandardAuthorizationCollection(lines)
        this.authStatus.json = 'Clean'
    }

}

export default ReadOnlyAssetWorkspace
