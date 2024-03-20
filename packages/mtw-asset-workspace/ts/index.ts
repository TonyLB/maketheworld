import { v4 as uuidv4 } from 'uuid'

import Normalizer from '@tonylb/mtw-wml/dist/normalize/index'
import { Schema } from '@tonylb/mtw-wml/dist/schema/index'
import { Standardizer } from '@tonylb/mtw-wml/ts/standardize'
import { isNormalImport, NormalAction, NormalBookmark, NormalCharacter, NormalComputed, NormalFeature, NormalItem, NormalKnowledge, NormalMap, NormalMessage, NormalMoment, NormalRoom, NormalVariable } from '@tonylb/mtw-wml/ts/normalize/baseClasses'
import { stripIdFromNormal } from '@tonylb/mtw-wml/ts/normalize/genericId'

import { s3Client } from "./clients"
import { deepEqual, objectFilterEntries } from "./objects"
import ReadOnlyAssetWorkspace from "./readOnly"
import { isImportable, isSchemaAsset, isSchemaCharacter, isSchemaImport, isSchemaWithKey, SchemaAssetTag, SchemaCharacterTag, SchemaStoryTag, SchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'

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
        const schema = new Schema()
        schema.loadWML(source)
        const standardizer = new Standardizer(schema.schema)
        normalizer.loadSchema(standardizer.schema)
        if (!(this.normal && deepEqual(stripIdFromNormal(this.normal), stripIdFromNormal(normalizer.normal)))) {
            this.status.json = 'Dirty'
        }
        this.normal = normalizer.normal
        this.standard = standardizer.standardForm

        if (this._workspaceFromKey) {
            await Promise.all(Object.entries(standardizer._imports)
                .map(async ([importFrom, { value }]) => {
                    const importWorkspace = await this._workspaceFromKey?.(`ASSET#${importFrom}`)
                    if (importWorkspace) {
                        await importWorkspace.loadJSON()
                        const importNamespaceIdToDB = Object.assign({}, ...(importWorkspace.namespaceIdToDB || []).map(({ internalKey, universalKey, exportAs }) => ({ [exportAs ?? internalKey]: universalKey })))
                        value
                            .map(({ data }) => (data))
                            .filter(isImportable)
                            .forEach(({ key, from }) => {
                                const exportAs = (this.normal ?? {})[key]?.exportAs
                                if (importNamespaceIdToDB[from ?? '']) {
                                    this.namespaceIdToDB = [
                                        ...this.namespaceIdToDB.filter(({ internalKey }) => (internalKey !== key)),
                                        { internalKey: key, universalKey: importNamespaceIdToDB[from ?? ''], ...(exportAs ? { exportAs } : {} ) }
                                    ]
                                }
                            })
                    }
                })
            )
        }
        //
        // TODO (ISS-3603): Refactor namespaceIdToDB mapping to derive from standard rather than normal
        //
        Object.values(this.standard)
            .filter(({ key }) => (!(this.universalKey(key))))
            .forEach(({ tag, key }) => {
                this.status.json = 'Dirty'
                const exportNode = standardizer._exports.map(({ children }) => (children.map(({ data }) => (data)))).flat(1).find((data) => (isSchemaWithKey(data) && data.key === key))
                const exportAs = exportNode && isImportable(exportNode) && exportNode.as
                this.namespaceIdToDB = [
                    ...this.namespaceIdToDB,
                    { internalKey: key, universalKey: `${tag.toUpperCase()}#${this._isGlobal ? key : uuidv4()}`, ...(exportAs ? { exportAs } : {} ) }
                ]
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
