import { GetObjectCommand, NotFound } from "@aws-sdk/client-s3"
import { v4 as uuidv4 } from 'uuid'

import { schemaFromParse } from '@tonylb/mtw-wml/dist/schema/index'
import parser from '@tonylb/mtw-wml/dist/parser/index'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer/index'
import Normalizer from '@tonylb/mtw-wml/dist/normalize/index'
import { NormalCharacter, NormalFeature, NormalForm, NormalItem, NormalMap, NormalRoom } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import SourceStream from "@tonylb/mtw-wml/dist/parser/tokenizer/sourceStream"

import { AssetWorkspaceException } from "./errors"
import { streamToString } from "./stream"
import { s3Client } from "./clients"

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

type AssetWorkspaceConstructorArgs = AssetWorkspaceConstructorCanon | AssetWorkspaceConstructorLibrary | AssetWorkspaceConstructorPersonal

type AssetWorkspaceStatus = 'Initial' | 'Clean' | 'Dirty' | 'Error'

type ImportTree = {
    [name: string]: ImportTree
}

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
    importTree: ImportTree = {};
    
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

    async loadJSON() {
        const subFolderElements = (this.subFolder || '').split('/')
        const subFolderOutput = subFolderElements.length > 0 ? `${subFolderElements.join('/')}/` : ''

        const filePath = this.zone === 'Personal'
            ? `${this.zone}/${subFolderOutput}${this.player}/${this.fileName}.json`
            : `${this.zone}/${subFolderOutput}${this.fileName}.json`
        
        let contents = ''
        try {
            const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: filePath
            }))
            contents = await streamToString(contentStream)
        }
        catch(err) {
            if (err instanceof NotFound) {
                this.normal = {}
                this.importTree = {}
                this.status = 'Clean'
                return
            }
            throw err
        }
        
        const { importTree = {}, normalForm = {} } = JSON.parse(contents)

        this.normal = normalForm as NormalForm
        this.importTree = importTree as ImportTree
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
        Object.values(this.normal)
            .filter(isMappableNormalItem)
            .forEach(({ key }) => {
                if (!(key in this.namespaceIdToDB)) {
                    this.namespaceIdToDB[key] = uuidv4()
                }
            })
        this.status = 'Clean'
    }

    async loadWML(): Promise<void> {
        const subFolderElements = (this.subFolder || '').split('/')
        const subFolderOutput = subFolderElements.length > 0 ? `${subFolderElements.join('/')}/` : ''

        const filePath = this.zone === 'Personal'
            ? `${this.zone}/${subFolderOutput}${this.player}/${this.fileName}.wml`
            : `${this.zone}/${subFolderOutput}${this.fileName}.wml`
        
        let contents = ''
        try {
            const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: filePath
            }))
            contents = await streamToString(contentStream)
        }
        catch(err) {
            if (err instanceof NotFound) {
                this.status = 'Error'
                return
            }
            throw err
        }

        this.setWML(contents)
        //
        // TODO: Check ScopeMap class and figure out what needs to be refactored to work here
        //

        //
        // TODO: Add any imported-but-not-yet-mapped keys to the namespaceToDB mapping
        //

        //
        // TODO: Add any newly created keys to the namespaceToDB mapping
        //
    }
}

export default AssetWorkspace
