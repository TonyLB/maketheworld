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

export const parseAssetWorkspaceAddress = (fileName: string): AssetWorkspaceAddress => {
    const folders = fileName.split('/').filter((value) => (value))
    const testZone = folders[0]
    if (!['Canon', 'Library', 'Personal'].includes(testZone)) {
        throw new AssetWorkspaceException(`"${testZone}" is not a legal Asset zone`)
    }
    const zone = testZone as 'Canon' | 'Library' | 'Personal'
    if (zone === 'Personal') {
        if (folders.length < 3) {
            throw new AssetWorkspaceException(`"${fileName}" is not a legal Asset address`)
        }
        return {
            zone,
            player: folders[1],
            subFolder: folders.length > 3 ? folders.slice(2, -1).join('/') : undefined,
            fileName: folders.slice(-1)[0]
        }
    }
    else {
        if (folders.length < 2) {
            throw new AssetWorkspaceException(`"${fileName}" is not a legal Asset address`)
        }
        return {
            zone,
            subFolder: folders.length > 2 ? folders.slice(1, -1).join('/') : undefined,
            fileName: folders.slice(-1)[0]
        }
    }
}

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
        if (this.address.zone === 'Draft') {
            return `Personal/${this.address.player}/Assets/`
        }
        if (this.address.zone === 'Archive') {
            return ''
        }
        const subFolderElements = (this.address.subFolder || '').split('/').filter((value) => (value))
        const subFolderOutput = (subFolderElements.length > 0) ? `${subFolderElements.join('/')}/` : ''

        const filePath = this.address.zone === 'Personal'
            ? `${this.address.zone}/${this.address.player}/${subFolderOutput}`
            : `${this.address.zone}/${subFolderOutput}`
        return filePath
    }

    get fileNameBase(): string {
        return `${this.filePath}${this.fileName}`
    }

    get fileName(): string {
        return this.address.zone === 'Archive' ? '' : this.address.zone === 'Draft' ? 'draft' : this.address.fileName
    }

    //
    // forceDefault assumes that it is being called on a draft workspace ... would need to be refactored in order to
    // operate on a workspace where key is defined differently.
    //
    async forceDefault(): Promise<void> {
        const Key = `${this.fileNameBase}.wml`
        const found = await s3Client.check({ Key })
        if (!found) {
            //
            // If no object exists, create default files for a draft asset
            //
            await Promise.all([
                s3Client.put({
                    Key,
                    Body: `<Asset uuid=(draft) />`
                }),
                s3Client.put({
                    Key: `${this.fileNameBase}.ndjson`,
                    Body: `{"tag":"Asset","key":"draft"}`
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
