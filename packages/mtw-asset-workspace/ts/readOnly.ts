import { GetObjectCommand } from "@aws-sdk/client-s3"

import { StandardAsset } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import { AssetWorkspaceException } from "./errors"
import { s3Client } from "./clients"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { isStandardAuthorizationCollectionNDJSON, StandardAuthorizationCollection } from "@tonylb/mtw-wml/ts/standardize/authorization"
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/ts/types"

const { S3_BUCKET = 'Test' } = process.env;

type AssetWorkspaceConstructorBase = {
    fileName: string;
    subFolder?: string;
}

type AssetWorkspaceConstructorCanon = {
    zone: 'Canon';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorLibrary = {
    zone: 'Library';
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorPersonal = {
    zone: 'Personal';
    player: string;
} & AssetWorkspaceConstructorBase

type AssetWorkspaceConstructorDraft = {
    zone: 'Draft';
    player: string;
}

type AssetWorkspaceConstructorArchive = {
    zone: 'Archive';
    backupId: `BACKUP#${string}`;
}

export type AssetWorkspaceAddress = AssetWorkspaceConstructorCanon | AssetWorkspaceConstructorLibrary | AssetWorkspaceConstructorPersonal | AssetWorkspaceConstructorDraft | AssetWorkspaceConstructorArchive

export const isAssetWorkspaceAddress = (item: any): item is AssetWorkspaceAddress => {
    if (!item) {
        return false
    }
    if (!(typeof item === 'object')) {
        return false
    }
    if (!(item.fileName && typeof item.fileName === 'string')) {
        return false
    }
    if (!(item.zone && typeof item.zone === 'string')) {
        return false
    }
    if (item.zone === 'Draft' && item.player && typeof item.player === 'string') {
        return true
    }
    if (item.subFolder && typeof item.subFolder !== 'string') {
        return false
    }
    if (item.zone === 'Personal' && !(item.player && typeof item.player === 'string')) {
        return false
    }
    if (item.zone === 'Archive' && !(item.backupId && typeof item.backupId === 'string' && item.backupId.startsWith('BACKUP#'))) {
        return false
    }
    return true
}

// parseAssetWorkspaceAddress removed in Phase 1 migration
// With flat UUID-based storage, zone-based path parsing is no longer needed

type AssetWorkspaceStatusItem = 'Initial' | 'Clean' | 'Dirty' | 'Error'

type AssetWorkspaceStatus = {
    json: AssetWorkspaceStatusItem;
    wml: AssetWorkspaceStatusItem;
}

export type WorkspaceImageProperty = {
    fileName: string;
}

export type WorkspacePropertyItem = WorkspaceImageProperty

export type WorkspaceProperties = {
    [name: string]: WorkspacePropertyItem;
}

type AddressLookup = {
    (key: `ASSET#${string}`): Promise<ReadOnlyAssetWorkspace | undefined>;
}

export type Zone = 'Canon' | 'Library' | 'Personal' | 'Draft' | 'Archive'

export class ReadOnlyAssetWorkspace {
    address: AssetWorkspaceAddress;
    assetId?: string;
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
    _workspaceFromKey?: AddressLookup;
    
    // New constructor signature using UUID + Zone + Player directly
    constructor(assetId: string, zone: Zone, player?: string)
    // Legacy constructor using AssetWorkspaceAddress
    constructor(address: AssetWorkspaceAddress)
    // Implementation
    constructor(
        assetIdOrAddress: string | AssetWorkspaceAddress,
        zone?: Zone,
        player?: string
    ) {
        if (typeof assetIdOrAddress === 'string') {
            // Phase 1B: New path - construct from UUID + Zone + Player
            const assetId = assetIdOrAddress
            if (!zone) {
                throw new AssetWorkspaceException('Zone is required when constructing from assetId')
            }
            this.assetId = assetId
            
            // Build legacy address for backward compatibility
            // Will be removed in Phase 2
            const fileName = assetId.replace('ASSET#', '').replace('CHARACTER#', '')
            if (zone === 'Personal' || zone === 'Draft') {
                if (!player) {
                    throw new AssetWorkspaceException('Player is required for Personal/Draft zones')
                }
                this.address = {
                    zone,
                    player,
                    fileName,
                    subFolder: 'Assets'
                } as AssetWorkspaceAddress
            } else if (zone === 'Archive') {
                throw new AssetWorkspaceException('Archive zone not supported in new constructor')
            } else {
                // Canon or Library
                this.address = {
                    zone,
                    fileName,
                    subFolder: 'Assets'
                } as AssetWorkspaceAddress
            }
        } else {
            // Legacy path - construct from address
            const args = assetIdOrAddress
            if (!(args.zone === 'Draft' || args.zone === 'Archive' || args.fileName)) {
                throw new AssetWorkspaceException('Invalid arguments to AssetWorkspace constructor')
            }
            this.address = args
        }
    }

    /**
     * Create ReadOnlyAssetWorkspace from UUID by fetching metadata
     * 
     * Fetches zone and player information from DynamoDB (Meta::Asset) with
     * S3 fallback (reading Zone tag and player metadata).
     * 
     */
    static async fromUUID(assetId: string, options?: {
        preferDynamo?: boolean
        allowS3Fallback?: boolean
    }): Promise<ReadOnlyAssetWorkspace | undefined> {
        const { preferDynamo = true, allowS3Fallback = true } = options || {}
        
        // Determine the appropriate DataCategory based on assetId type
        const [type] = splitType(assetId)
        const dataCategory = type === 'CHARACTER' ? 'Meta::Character' : 'Meta::Asset'
        
        // Try DynamoDB first if preferred
        if (preferDynamo) {
            try {
                const { zone, player } = (await assetDB.getItem<{ zone?: Zone; player?: string }>({
                    Key: {
                        AssetId: assetId,
                        DataCategory: dataCategory
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
                const fileName = assetId.replace('ASSET#', '').replace('CHARACTER#', '')
                
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
        return (this.address.zone === 'Canon' && this.address.fileName === 'primitives')
    }

    get filePath(): string {
        // Phase 1: Flat UUID-based storage - no subdirectories
        return ''
    }

    get fileNameBase(): string {
        return this.fileName
    }

    get fileName(): string {
        // Phase 1: Use UUID (without ASSET# prefix) as the filename
        if (this.assetId) {
            return this.assetId.replace('ASSET#', '')
        }
        
        // Fallback to address.fileName for backward compatibility during transition
        // This handles cases where assetId hasn't been set yet
        if ('fileName' in this.address) {
            return this.address.fileName || ''
        }
        return ''
    }

    //
    // forceDefault creates default empty draft files if they don't exist
    // Phase 1: Uses UUID-based naming with flat structure and Zone tags
    //
    async forceDefault(): Promise<void> {
        const Key = `${this.fileNameBase}.wml`
        const found = await s3Client.check({ Key })
        if (!found) {
            //
            // If no object exists, create default files for a draft asset
            // Note: assetId should already be set with the draft's UUID
            //
            const uuid = this.assetId?.replace('ASSET#', '') || 'draft'
            
            // Phase 1: Add Zone tag to S3 objects
            const tags = { Zone: this.address.zone }
            const metadata = this.address.zone === 'Personal' && this.address.player
                ? { player: this.address.player }
                : undefined
            
            await Promise.all([
                s3Client.putWithTags({
                    Key,
                    Body: `<Asset uuid=(${uuid}) />`,
                    Tags: tags,
                    Metadata: metadata
                }),
                s3Client.putWithTags({
                    Key: `${this.fileNameBase}.ndjson`,
                    Body: `{"tag":"Asset","universalKey":"${this.assetId || 'ASSET#draft'}"}`,
                    Tags: tags,
                    Metadata: metadata
                })
            ])
        }

    }
    
    async presignedURL(): Promise<string> {
        const getCommand = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${this.fileNameBase}.wml`
        })
        const presignedOutput = await getSignedUrl(s3Client.internalClient as any, getCommand as any, { expiresIn: 60 })
        return presignedOutput
    
    }

    setWorkspaceLookup(lookup: AddressLookup) {
        this._workspaceFromKey = lookup
    }

    async loadJSON() {
        if (this.address.zone === 'Archive') {
            this.standard = new StandardForm('')
            this.status.json = 'Clean'
            return
        }
        const filePath = `${this.fileNameBase}.ndjson`
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.standard = new StandardForm('')
                this.status.json = 'Clean'
                return
            }
            throw err
        }
        
        const lines = contents.split('\n').map((line) => (JSON.parse(line)))
        this.standard = new StandardForm(lines)
        this.status.json = 'Clean'
    }

    async loadAuthorizationJSON() {
        if (this.address.zone === 'Archive') {
            this.authorizations = new StandardAuthorizationCollection('')
            this.authStatus.json = 'Clean'
            return
        }
        const filePath = `${this.fileNameBase}.auth.ndjson`
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.authorizations = new StandardAuthorizationCollection('')
                this.authStatus.json = 'Clean'
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

    get rootNodes(): StandardAsset[] {
        const key = this.standard?.key
        return key
            ? [{ tag: 'Asset', key }]
            : []
    }

}

export default ReadOnlyAssetWorkspace
