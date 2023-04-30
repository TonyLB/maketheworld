import { GetObjectCommand } from "@aws-sdk/client-s3"
import { v4 as uuidv4 } from 'uuid'

import { schemaFromParse } from '@tonylb/mtw-wml/dist/schema/index'
import parser from '@tonylb/mtw-wml/dist/parser/index'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer/index'
import Normalizer from '@tonylb/mtw-wml/dist/normalize/index'
import { isNormalAsset, isNormalCharacter, NormalAction, NormalAsset, NormalBookmark, NormalCharacter, NormalComputed, NormalFeature, NormalForm, NormalItem, NormalMap, NormalMessage, NormalMoment, NormalRoom, NormalVariable } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import SourceStream from "@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream"

import { AssetWorkspaceException } from "./errors"
import { s3Client } from "./clients"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { ParseException } from "@tonylb/mtw-wml/dist/parser/baseClasses"
import { deepEqual, objectFilterEntries } from "./objects"

const { S3_BUCKET = 'Test', UPLOAD_BUCKET = 'Test' } = process.env;

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

export type NamespaceMapping = {
    [name: string]: string
}

export type WorkspaceImageProperty = {
    fileName: string;
}

export type WorkspacePropertyItem = WorkspaceImageProperty

export type WorkspaceProperties = {
    [name: string]: WorkspacePropertyItem;
}

const isMappableNormalItem = (item: NormalItem): item is (NormalRoom | NormalFeature | NormalBookmark | NormalMap | NormalCharacter | NormalAction | NormalVariable | NormalComputed | NormalMessage | NormalMoment) => (['Room', 'Feature', 'Bookmark', 'Message', 'Moment', 'Map', 'Character', 'Action', 'Variable', 'Computed'].includes(item.tag))

export class AssetWorkspace {
    address: AssetWorkspaceAddress;
    status: AssetWorkspaceStatus = {
        json: 'Initial',
        wml: 'Initial'
    };
    normal?: NormalForm;
    namespaceIdToDB: NamespaceMapping = {};
    properties: WorkspaceProperties = {};
    wml?: string;
    _isGlobal?: boolean;
    
    constructor(args: AssetWorkspaceAddress) {
        if (!args.fileName) {
            throw new AssetWorkspaceException('Invalid arguments to AssetWorkspace constructor')
        }
        this.address = args
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

    async presignedURL(): Promise<string> {
        const getCommand = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: `${this.fileNameBase}.wml`
        })
        const presignedOutput = await getSignedUrl(s3Client.internalClient, getCommand, { expiresIn: 60 })
        return presignedOutput
    
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
                this.namespaceIdToDB = {}
                this.properties = {}
                this.status.json = 'Clean'
                return
            }
            throw err
        }
        
        const { namespaceIdToDB = {}, normal = {}, properties = {} } = JSON.parse(contents)

        this.normal = normal as NormalForm
        this.namespaceIdToDB = namespaceIdToDB as NamespaceMapping
        this.properties = properties as WorkspaceProperties
        this.status.json = 'Clean'
    }

    //
    // TODO: Refactor tokenizer, parser, and schema to accept generators, then make setWML capable of
    // reading in a stream, and processing it as it arrives
    //
    async setWML(source: string): Promise<void> {
        const normalizer = new Normalizer()
        normalizer.loadWML(source)
        normalizer.standardize()
        if (!(this.normal && deepEqual(this.normal, normalizer.normal))) {
            this.status.json = 'Dirty'
        }
        this.normal = normalizer.normal
        //
        // TODO: For any imports, pull in the JSON for the asset being imported from, and extract
        // the namespaceIdToDB 
        //
        Object.values(this.normal)
            .filter(isMappableNormalItem)
            .filter(({ key }) => (!(key in this.namespaceIdToDB)))
            .forEach(({ tag, key }) => {
                this.status.json = 'Dirty'
                this.namespaceIdToDB[key] = `${tag.toUpperCase()}#${this._isGlobal ? key : uuidv4()}`
            })
        //
        // TODO: Extend setWML to check for entries in namespaceIdToDB that no longer have a
        // corresponding normal entry, and remove
        //
        this.wml = source
        this.status.wml = 'Dirty'
    }

    async loadWML(): Promise<void> {
        const filePath = `${this.fileNameBase}.wml`
        
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

    async pushJSON(): Promise<void> {
        const filePath = `${this.fileNameBase}.json`
        const contents = JSON.stringify({
            namespaceIdToDB: this.namespaceIdToDB,
            normal: this.normal || {},
            properties: objectFilterEntries(this.properties, ([key]) => (key in (this.normal || {})))
        })
        await s3Client.put({
            Key: filePath,
            Body: contents
        })
        this.status.json = 'Clean'
    }

    async pushWML(): Promise<void> {
        const filePath = `${this.fileNameBase}.wml`
        await s3Client.put({
            Key: filePath,
            Body: this.wml || ''
        })
        this.status.wml = 'Clean'
    }

    get rootNodes(): (NormalAsset | NormalCharacter)[] {
        return Object.values(this.normal || {})
            .filter((node): node is NormalAsset | NormalCharacter => (isNormalAsset(node) || isNormalCharacter(node)))
            .filter(({ appearances }) => (appearances.find(({ contextStack }) => (contextStack.length === 0))))
    }

}

export default AssetWorkspace
