import { v4 as uuidv4 } from 'uuid'

import { Schema, schemaToWML } from '@tonylb/mtw-wml/dist/schema/index'
import { Standardizer } from '@tonylb/mtw-wml/ts/standardize'
import { serialize } from '@tonylb/mtw-wml/ts/standardize/serialize'

import { s3Client } from "./clients"
import { deepEqual, objectFilterEntries } from "./objects"
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from "./readOnly"
import { isImportable, isSchemaExport, isSchemaImport, isSchemaWithKey } from '@tonylb/mtw-wml/dist/schema/baseClasses'
import { treeNodeTypeguard } from '@tonylb/mtw-wml/ts/tree/baseClasses'

export { AssetWorkspaceAddress, isAssetWorkspaceAddress, parseAssetWorkspaceAddress } from './readOnly'

export class AssetWorkspace extends ReadOnlyAssetWorkspace {
    wml?: string;

    changeAddress(address: AssetWorkspaceAddress) {
        this.address = address
    }

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
        }

        if (this._workspaceFromKey) {
            const exportMapping = standardizer.metaData
                .filter(treeNodeTypeguard(isSchemaExport))
                .reduce((previous, { children }) => {
                    return Object.assign(previous,
                        ...children
                            .filter(treeNodeTypeguard(isImportable))
                            .map(({ data }) => (data))
                            .map(({ key, as }) => {
                                as ? { [key]: as } : {}
                            })
                    )
                }, {})
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
                                const exportAs = exportMapping[key]
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

        if (this.standard?.tag === 'Asset') {
            this.assetId = `ASSET#${this.standard?.key}`
        }
        if (this.standard?.tag === 'Character') {
            this.assetId = this.universalKey(this.standard?.key) as `CHARACTER#${string}`
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

    override async loadJSON(): Promise<void> {
        await super.loadJSON()
        const standardizer = new Standardizer()
        if (this.standard) {
            standardizer.loadStandardForm(this.standard)
            this.wml = schemaToWML(standardizer.schema)
            this.status.wml = 'Clean'
        }
    }

    async pushJSON(): Promise<void> {
        const filePath = `${this.fileNameBase}.json`
        const standardForm = this.standard || { key: this.assetId?.split('#')?.slice(1)?.[0] || '', tag: 'Asset', byId: {}, metaData: [] }
        const contents = JSON.stringify({
            assetId: this.assetId ?? '',
            namespaceIdToDB: this.namespaceIdToDB,
            standard: standardForm,
            properties: objectFilterEntries(this.properties, ([key]) => ((key in (this.standard?.byId || {})) || (key === this.standard?.key)))
        })
        const serializedOutput = serialize(
            standardForm,
            (key) => {
                const namespaceEntry = this.namespaceIdToDB.find(({ internalKey }) => (key === internalKey))
                return namespaceEntry?.universalKey
            },
            (key) => (this.properties[key]?.fileName)
        )
        await Promise.all([
            s3Client.put({
                Key: filePath,
                Body: contents
            }),
            s3Client.put({
                Key: `${this.fileNameBase}.ndjson`,
                Body: serializedOutput.map((line) => (JSON.stringify(line))).join('\n')
            })
        ])
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
