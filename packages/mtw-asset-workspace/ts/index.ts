import { v4 as uuidv4 } from 'uuid'

import Normalizer from '@tonylb/mtw-wml/dist/normalize/index'
import { isNormalAsset, isNormalCharacter, isNormalImport, NormalAction, NormalAsset, NormalBookmark, NormalCharacter, NormalComputed, NormalFeature, NormalItem, NormalKnowledge, NormalMap, NormalMessage, NormalMoment, NormalRoom, NormalVariable } from '@tonylb/mtw-normal'

import { s3Client } from "./clients"
import { deepEqual, objectFilterEntries } from "./objects"
import ReadOnlyAssetWorkspace from "./readOnly"

export { AssetWorkspaceAddress, isAssetWorkspaceAddress, parseAssetWorkspaceAddress } from './readOnly'

const isMappableNormalItem = (item: NormalItem): item is (NormalRoom | NormalFeature | NormalKnowledge | NormalBookmark | NormalMap | NormalCharacter | NormalAction | NormalVariable | NormalComputed | NormalMessage | NormalMoment) => (['Room', 'Feature', 'Knowledge', 'Bookmark', 'Message', 'Moment', 'Map', 'Character', 'Action', 'Variable', 'Computed'].includes(item.tag))

export class AssetWorkspace extends ReadOnlyAssetWorkspace {
    wml?: string;

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
        if (this._workspaceFromKey) {
            await Promise.all(Object.values(this.normal)
                .filter(isNormalImport)
                .map(async ({ from, mapping }) => {
                    const importWorkspace = await this._workspaceFromKey?.(`ASSET#${from}`)
                    if (importWorkspace) {
                        await importWorkspace.loadJSON()
                        const importNamespaceIdToDB = importWorkspace.namespaceIdToDB || {}
                        Object.entries(mapping)
                            .forEach(([localKey, { key: sourceKey }]) => {
                                if (importNamespaceIdToDB[sourceKey]) {
                                    this.namespaceIdToDB[localKey] = importNamespaceIdToDB[sourceKey]
                                }
                            })
                    }
                })
            )
        }
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

}

export default AssetWorkspace
