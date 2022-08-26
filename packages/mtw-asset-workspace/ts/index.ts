import { NotFound } from "@aws-sdk/client-s3"
import { v4 as uuidv4 } from 'uuid'

import { schemaFromParse } from '@tonylb/mtw-wml/dist/schema/index'
import parser from '@tonylb/mtw-wml/dist/parser/index'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer/index'
import Normalizer from '@tonylb/mtw-wml/dist/normalize/index'
import { NormalCharacter, NormalFeature, NormalForm, NormalItem, NormalMap, NormalRoom } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import SourceStream from "@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream"

import { AssetWorkspaceException } from "./errors"
import { s3Client } from "./clients"

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

type AssetWorkspaceConstructorArgs = AssetWorkspaceConstructorCanon | AssetWorkspaceConstructorLibrary | AssetWorkspaceConstructorPersonal

type AssetWorkspaceStatus = 'Initial' | 'Clean' | 'Dirty' | 'Error'

type NamespaceMapping = {
    [name: string]: string
}

const isMappableNormalItem = (item: NormalItem | NormalCharacter): item is (NormalRoom | NormalFeature | NormalMap | NormalCharacter) => (['Room', 'Feature', 'Map', 'Character'].includes(item.tag))

export class AssetWorkspace {
    fileName: string;
    zone: 'Canon' | 'Library' | 'Personal';
    subFolder?: string;
    player?: string;
    status: AssetWorkspaceStatus = 'Initial';
    normal?: NormalForm;
    namespaceIdToDB: NamespaceMapping = {};
    wml?: string;
    
    constructor(args: AssetWorkspaceConstructorArgs) {
        if (!args.fileName) {
            throw new AssetWorkspaceException('Invalid arguments to AssetWorkspace constructor')
        }
        this.fileName = args.fileName
        this.zone = args.zone
        this.subFolder = args.subFolder
        if (args.zone === 'Personal') {
            this.player = args.player
        }
    }

    get fileNameBase(): string {
        const subFolderElements = (this.subFolder || '').split('/')
        const subFolderOutput = subFolderElements.length > 0 ? `${subFolderElements.join('/')}/` : ''

        const filePath = this.zone === 'Personal'
            ? `${this.zone}/${subFolderOutput}${this.player}/${this.fileName}`
            : `${this.zone}/${subFolderOutput}${this.fileName}`
        return filePath
    }
    async loadJSON() {
        const filePath = `${this.fileNameBase}.json`
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err) {
            if (err instanceof NotFound) {
                this.normal = {}
                this.wml = ''
                this.namespaceIdToDB = {}
                this.status = 'Clean'
                return
            }
            throw err
        }
        
        const { namespaceIdToDB = {}, normalForm = {} } = JSON.parse(contents)

        this.normal = normalForm as NormalForm
        this.namespaceIdToDB = namespaceIdToDB as NamespaceMapping
        this.status = 'Clean'
    }

    //
    // TODO: Refactor tokenizer, parser, and schema to accept generators, then make setWML capable of
    // reading in a stream, and processing it as it arrives
    //
    setWML(source: string): void {
        const schema = schemaFromParse(parser(tokenizer(new SourceStream(source))))
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
            .forEach(({ key }) => {
                if (!(key in this.namespaceIdToDB)) {
                    this.namespaceIdToDB[key] = uuidv4()
                }
            })
        this.wml = source
        this.status = 'Clean'
    }

    async loadWML(): Promise<void> {
        const filePath = `${this.fileNameBase}.wml`
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err) {
            if (err instanceof NotFound) {
                this.status = 'Error'
                return
            }
            throw err
        }

        this.setWML(contents)
    }

    async pushJSON(): Promise<void> {
        const filePath = `${this.fileNameBase}.json`
        const contents = JSON.stringify({}, null, 4)
        await s3Client.put({
            Key: filePath,
            Body: contents
        })
    }

}

export default AssetWorkspace
