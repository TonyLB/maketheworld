import { NotFound } from "@aws-sdk/client-s3"
import { v4 as uuidv4 } from 'uuid'

import { schemaFromParse } from '@tonylb/mtw-wml/dist/schema/index'
import parser from '@tonylb/mtw-wml/dist/parser/index'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer/index'
import Normalizer from '@tonylb/mtw-wml/dist/normalize/index'
import { NormalAction, NormalCharacter, NormalFeature, NormalForm, NormalItem, NormalMap, NormalRoom } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import SourceStream from "@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream"

import { AssetWorkspaceException } from "./errors"
import { s3Client } from "./clients"
import { ParseException } from "@tonylb/mtw-wml/dist/parser/baseClasses"

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

const isMappableNormalItem = (item: NormalItem): item is (NormalRoom | NormalFeature | NormalMap | NormalCharacter | NormalAction) => (['Room', 'Feature', 'Map', 'Character', 'Action'].includes(item.tag))

export class AssetWorkspace {
    address: AssetWorkspaceAddress;
    status: AssetWorkspaceStatus = {
        json: 'Initial',
        wml: 'Initial'
    };
    normal?: NormalForm;
    namespaceIdToDB: NamespaceMapping = {};
    wml?: string;
    
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
                this.status.json = 'Clean'
                return
            }
            throw err
        }
        
        const { namespaceIdToDB = {}, normal = {} } = JSON.parse(contents)

        this.normal = normal as NormalForm
        this.namespaceIdToDB = namespaceIdToDB as NamespaceMapping
        this.status.json = 'Clean'
    }

    //
    // TODO: Refactor tokenizer, parser, and schema to accept generators, then make setWML capable of
    // reading in a stream, and processing it as it arrives
    //
    setWML(source: string): void {
        const schema = schemaFromParse(parser(tokenizer(new SourceStream(source))))

        //
        // TEMPORARY PROVISION:  Until there's a proper architecture for having multiple
        // assets defined in the same WML file, throw an exception here if a multi-asset
        // file is encountered.
        //
        if (schema.length > 1) {
            throw new ParseException('Multi-Asset files are not yet implemented', schema[1].parse.startTagToken, schema[1].parse.startTagToken)
        }
        const normalizer = new Normalizer()
        schema.forEach((item, index) => {
            normalizer.add(item, { contextStack: [], location: [index] })
        })
        this.normal = normalizer.normal
        //
        // TODO: Add any imported-but-not-yet-mapped keys to the namespaceToDB mapping
        //
        Object.values(this.normal)
            .filter(isMappableNormalItem)
            .forEach(({ tag, key }) => {
                if (!(key in this.namespaceIdToDB)) {
                    this.namespaceIdToDB[key] = `${tag.toUpperCase()}#${uuidv4()}`
                }
            })
        this.wml = source
        this.status.wml = 'Dirty'
        this.status.json = 'Dirty'
    }

    async loadWML(): Promise<void> {
        const filePath = `${this.fileNameBase}.wml`
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err) {
            if (err instanceof NotFound) {
                this.status.wml = 'Error'
                return
            }
            throw err
        }

        this.setWML(contents)
        this.status.wml = 'Clean'
    }

    async loadWMLFrom(filePath: string): Promise<void> {
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err) {
            if (err instanceof NotFound) {
                this.status.wml = 'Error'
                return
            }
            throw err
        }

        this.setWML(contents)
        this.status.wml = 'Clean'
    }

    async pushJSON(): Promise<void> {
        const filePath = `${this.fileNameBase}.json`
        const contents = JSON.stringify({
            namespaceIdToDB: this.namespaceIdToDB,
            normal: this.normal || {}
        }, null, 4)
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

}

export default AssetWorkspace
