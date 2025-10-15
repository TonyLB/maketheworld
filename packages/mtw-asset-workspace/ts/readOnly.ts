import { GetObjectCommand } from "@aws-sdk/client-s3"

import { StandardAsset } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import { AssetWorkspaceException } from "./errors"
import { s3Client } from "./clients"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { StandardForm } from "@tonylb/mtw-wml/ts/standardize"
import { isStandardAuthorizationCollectionNDJSON, StandardAuthorizationCollection } from "@tonylb/mtw-wml/ts/standardize/authorization"

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
    
    constructor(args: AssetWorkspaceAddress) {
        if (!(args.zone === 'Draft' || args.zone === 'Archive' || args.fileName)) {
            throw new AssetWorkspaceException('Invalid arguments to AssetWorkspace constructor')
        }
        this.address = args
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
