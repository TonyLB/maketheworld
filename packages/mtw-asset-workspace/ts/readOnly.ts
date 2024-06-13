import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"

import { NormalAsset, NormalCharacter, NormalForm, isNormalAsset, isNormalCharacter } from '@tonylb/mtw-wml/ts/normalize/baseClasses'
import { SerializableStandardForm, StandardForm } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import { AssetWorkspaceException } from "./errors"
import { s3Client } from "./clients"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import Normalizer from "@tonylb/mtw-wml/ts/normalize"
import { Standardizer } from "@tonylb/mtw-wml/ts/standardize"

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

export type AssetWorkspaceAddress = AssetWorkspaceConstructorCanon | AssetWorkspaceConstructorLibrary | AssetWorkspaceConstructorPersonal | AssetWorkspaceConstructorDraft

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

export type NamespaceMappingItem = {
    internalKey: string;
    universalKey: string;
    exportAs?: string;
}

export type NamespaceMapping = NamespaceMappingItem[]

export type WorkspaceImageProperty = {
    fileName: string;
}

export type WorkspacePropertyItem = WorkspaceImageProperty

export type WorkspaceProperties = {
    [name: string]: WorkspacePropertyItem;
}

type AddressLookup = {
    (key: `ASSET#${string}` | `CHARACTER#${string}`): Promise<ReadOnlyAssetWorkspace | undefined>;
}

export class ReadOnlyAssetWorkspace {
    address: AssetWorkspaceAddress;
    assetId?: string;
    status: AssetWorkspaceStatus = {
        json: 'Initial',
        wml: 'Initial'
    };
    normal?: NormalForm;
    standard?: SerializableStandardForm;
    namespaceIdToDB: NamespaceMapping = [];
    properties: WorkspaceProperties = {};
    _workspaceFromKey?: AddressLookup;
    
    constructor(args: AssetWorkspaceAddress) {
        if (!(args.zone === 'Draft' || args.fileName)) {
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
        return this.address.zone === 'Draft' ? 'draft' : this.address.fileName
    }

    universalKey(searchKey: string): string | undefined {
        const matchingNamespaceItem = this.namespaceIdToDB.find(({ internalKey }) => (internalKey === searchKey))
        return matchingNamespaceItem?.universalKey
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
                    Body: `<Asset key=(draft) />`
                }),
                s3Client.put({
                    Key: `${this.fileNameBase}.json`,
                    Body: JSON.stringify({
                        assetId: "ASSET#draft",
                        namespaceIdToDB: [],
                        standard: { key: "draft", tag: "Asset", byId: {}, metaData: [] }
                    }, null, 4)
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
        const filePath = `${this.fileNameBase}.json`
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.normal = {}
                this.standard = { key: '', tag: 'Asset', byId: {}, metaData: [] }
                this.namespaceIdToDB = []
                this.properties = {}
                this.status.json = 'Clean'
                return
            }
            throw err
        }
        
        const { assetId = '', namespaceIdToDB = [], standard = {}, properties = {} } = JSON.parse(contents)
        if (!assetId) {
            this.normal = {}
            this.standard = { key: assetId.split('#').slice(1)[0] ?? '', tag: 'Asset', byId: {}, metaData: [] }
            this.namespaceIdToDB = []
            this.properties = {}
            this.status.json = 'Clean'
            return
        }

        this.standard = standard as StandardForm
        const normalizer = new Normalizer()
        const standardizer = new Standardizer()
        standardizer.loadStandardForm(standard)
        normalizer.loadSchema(standardizer.schema)
        this.normal = normalizer.normal
        this.namespaceIdToDB = namespaceIdToDB as NamespaceMapping
        this.properties = properties as WorkspaceProperties
        this.status.json = 'Clean'
    }

    get rootNodes(): (NormalAsset | NormalCharacter)[] {
        return Object.values(this.normal || {})
            .filter((node): node is NormalAsset | NormalCharacter => (isNormalAsset(node) || isNormalCharacter(node)))
            .filter(({ appearances }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
    }

}

export default ReadOnlyAssetWorkspace
