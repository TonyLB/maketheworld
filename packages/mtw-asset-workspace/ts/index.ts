import { GetObjectCommand, NotFound } from "@aws-sdk/client-s3"

import { schemaFromParse } from '@tonylb/mtw-wml/dist/schema'
import parser from '@tonylb/mtw-wml/dist/parser'
import tokenizer from '@tonylb/mtw-wml/dist/parser/tokenizer'
import Normalizer from '@tonylb/mtw-wml/dist/normalize/index'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
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

export class AssetWorkspace {
    fileName: string;
    zone: 'Canon' | 'Library' | 'Personal';
    subFolder?: string;
    player?: string;
    status: AssetWorkspaceStatus = 'Initial';
    normal?: NormalForm;
    importTree: ImportTree = {}
    
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

    async loadWML() {
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

        const schema = schemaFromParse(parser(tokenizer(new SourceStream(contents))))
        const normalizer = new Normalizer()
        schema.forEach((item, index) => {
            normalizer.add(item, { contextStack: [], location: [index] })
        })
        this.normal = normalizer.normal
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
