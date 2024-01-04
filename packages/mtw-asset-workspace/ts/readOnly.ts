import { GetObjectCommand } from "@aws-sdk/client-s3"

import { NormalAsset, NormalCharacter, NormalForm, isNormalAsset, isNormalCharacter } from '@tonylb/mtw-wml/ts/normalize/baseClasses'

import { AssetWorkspaceException } from "./errors"
import { s3Client } from "./clients"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

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

export type AssetWorkspaceAddress = AssetWorkspaceConstructorCanon | AssetWorkspaceConstructorLibrary | AssetWorkspaceConstructorPersonal

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

//
// TODO: Refactor NamespaceMapping from a Record<string, string> to:
//        {
//            internalKey: string;
//            universalKey: string;
//            exportAs?: string;
//        }[]
//
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
    status: AssetWorkspaceStatus = {
        json: 'Initial',
        wml: 'Initial'
    };
    normal?: NormalForm;
    namespaceIdToDB: NamespaceMapping = [];
    properties: WorkspaceProperties = {};
    _workspaceFromKey?: AddressLookup;
    
    constructor(args: AssetWorkspaceAddress) {
        if (!args.fileName) {
            throw new AssetWorkspaceException('Invalid arguments to AssetWorkspace constructor')
        }
        this.address = args
    }

    get _isGlobal(): boolean {
        return (this.address.zone === 'Canon' && this.address.fileName === 'primitives')
    }

    get filePath(): string {
        const subFolderElements = (this.address.subFolder || '').split('/').filter((value) => (value))
        const subFolderOutput = (subFolderElements.length > 0) ? `${subFolderElements.join('/')}/` : ''

        const filePath = this.address.zone === 'Personal'
            ? `${this.address.zone}/${this.address.player}/${subFolderOutput}`
            : `${this.address.zone}/${subFolderOutput}`
        return filePath
    }

    get fileNameBase(): string {
        return `${this.filePath}${this.address.fileName}`
    }

    get fileName(): string {
        return this.address.fileName
    }

    universalKey(searchKey: string): string | undefined {
        const matchingNamespaceItem = this.namespaceIdToDB.find(({ internalKey }) => (internalKey === searchKey))
        return matchingNamespaceItem?.universalKey
    }

    get assetId(): `ASSET#${string}` | `CHARACTER#${string}` | undefined {
        const assets: NormalForm = this.normal || {}
        const asset = Object.values(assets).find(isNormalAsset)
        if (asset && asset.key) {
            return `ASSET#${asset.key}`
        }
        const character = Object.values(assets).find(isNormalCharacter)
        if (character && character.key) {
            return this.universalKey(character.key) as `CHARACTER#${string}`
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
                this.namespaceIdToDB = []
                this.properties = {}
                this.status.json = 'Clean'
                return
            }
            throw err
        }
        
        const { namespaceIdToDB = [], normal = {}, properties = {} } = JSON.parse(contents)

        this.normal = normal as NormalForm
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
