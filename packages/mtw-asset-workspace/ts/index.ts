import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3"

import { NormalForm } from '@tonylb/mtw-wml/dist/normalize'
import { streamToString } from '@tonylb/mtw-utilities/dist/stream'

const { S3_BUCKET } = process.env;
const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

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
    error?: string;
    status: AssetWorkspaceStatus = 'Initial';
    normal?: NormalForm;
    importTree: ImportTree = {}
    
    constructor(args: AssetWorkspaceConstructorArgs) {
        if (!args.fileName) {
            this.fileName = ''
            this.zone = 'Library'
            this.error = 'Invalid arguments to AssetWorkspace constructor'
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
        
        //
        // TODO: Wrap S3 command in try/catch and smoothly handle instance where there is
        // no such file
        //
        const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: filePath
        }))
        const contents = await streamToString(contentStream)
        
        const { importTree = {}, normalForm = {} } = JSON.parse(contents)

        this.normal = normalForm as NormalForm
        this.importTree = importTree as ImportTree
    }
}