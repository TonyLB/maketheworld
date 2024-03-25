import { v4 as uuidv4 } from 'uuid'

import Normalizer from '@tonylb/mtw-wml/dist/normalize/index'
import { Schema } from '@tonylb/mtw-wml/dist/schema/index'
import { Standardizer } from '@tonylb/mtw-wml/ts/standardize'
import { NormalAction, NormalBookmark, NormalCharacter, NormalComputed, NormalFeature, NormalItem, NormalKnowledge, NormalMap, NormalMessage, NormalMoment, NormalRoom, NormalVariable } from '@tonylb/mtw-wml/ts/normalize/baseClasses'

import { s3Client } from "./clients"
import { deepEqual, objectFilterEntries } from "./objects"
import ReadOnlyAssetWorkspace from "./readOnly"
import { isImportable, isSchemaExport, isSchemaImport, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { isNormalAsset, isNormalCharacter } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { treeNodeTypeguard } from '@tonylb/mtw-wml/ts/tree/baseClasses'

export { AssetWorkspaceAddress, isAssetWorkspaceAddress, parseAssetWorkspaceAddress } from './readOnly'

export class AssetWorkspace extends ReadOnlyAssetWorkspace {
    wml?: string;

    //
    // TODO: Refactor tokenizer, parser, and schema to accept generators, then make setWML capable of
    // reading in a stream, and processing it as it arrives
    //
    async setWML(source: string): Promise<void> {
        const schema = new Schema()
        schema.loadWML(source)
        const standardizer = new Standardizer(schema.schema)
        if (!(this.standard && deepEqual(standardizer.stripped, this.standard))) {
            this.status.json = 'Dirty'
            this.standard = standardizer.stripped
            const normalizer = new Normalizer()
            normalizer.loadSchema(standardizer.schema)
            this.normal = normalizer.normal
        }

        if (this._workspaceFromKey) {
            await Promise.all(standardizer.metaData
                .filter(treeNodeTypeguard(isSchemaImport))
                .map(async (node) => {
                    const { data } = node
                    const { from: importFrom } = data
                    const importWorkspace = await this._workspaceFromKey?.(`ASSET#${importFrom}`)
                    if (importWorkspace) {
                        await importWorkspace.loadJSON()
                        const importNamespaceIdToDB = Object.assign({}, ...(importWorkspace.namespaceIdToDB || []).map(({ internalKey, universalKey, exportAs }) => ({ [exportAs ?? internalKey]: universalKey })))
                        node.children
                            .map(({ data }) => (data))
                            .filter(isImportable)
                            .forEach(({ key, from }) => {
                                const exportAs = (this.normal ?? {})[key]?.exportAs
                                if (importNamespaceIdToDB[from ?? key]) {
                                    this.namespaceIdToDB = [
                                        ...this.namespaceIdToDB.filter(({ internalKey }) => (internalKey !== key)),
                                        { internalKey: key, universalKey: importNamespaceIdToDB[from ?? key], ...(exportAs ? { exportAs } : {} ) }
                                    ]
                                }
                            })
                    }
                })
            )
        }

        Object.values(this.standard.byId)
            .filter(({ key }) => (!(this.universalKey(key))))
            .forEach(({ tag, key }) => {
                this.status.json = 'Dirty'
                const exportNode = standardizer.metaData
                    .filter(treeNodeTypeguard(isSchemaExport))
                    .map(({ children }) => (children.map(({ data }) => (data)))).flat(1).find((data) => (isSchemaWithKey(data) && data.key === key))
                const exportAs = exportNode && isImportable(exportNode) && exportNode.as
                this.namespaceIdToDB = [
                    ...this.namespaceIdToDB,
                    { internalKey: key, universalKey: `${tag.toUpperCase()}#${this._isGlobal ? key : uuidv4()}`, ...(exportAs ? { exportAs } : {} ) }
                ]
            })

        const asset = Object.values(this.normal || {}).find(isNormalAsset)
        if (asset && asset.key) {
            this.assetId = `ASSET#${asset.key}`
        }
        const character = Object.values(this.normal || {}).find(isNormalCharacter)
        if (character && character.key) {
            this.assetId = this.universalKey(character.key) as `CHARACTER#${string}`
        }

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
            assetId: this.assetId ?? '',
            namespaceIdToDB: this.namespaceIdToDB,
            normal: this.normal || {},
            standard: this.standard || { key: this.assetId?.split('#')?.slice(1)?.[0] || '', tag: 'Asset', byId: {}, metaData: [] },
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
