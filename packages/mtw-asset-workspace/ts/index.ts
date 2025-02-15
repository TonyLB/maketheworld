import { v4 as uuidv4 } from 'uuid'

import { schemaToWML } from '@tonylb/mtw-wml/ts/schema/index'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'

import { s3Client } from "./clients"
import { deepEqual } from "./objects"
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from "./readOnly"
import { ExportItemContent, ImportItemContent } from '@tonylb/mtw-wml/ts/standardize/components/metaData'
import { excludeUndefined } from '@tonylb/mtw-wml/ts/lib/lists'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'

export { AssetWorkspaceAddress, isAssetWorkspaceAddress, parseAssetWorkspaceAddress } from './readOnly'

export class AssetWorkspace extends ReadOnlyAssetWorkspace {

    get wml(): string | undefined {
        if (this.standard) {
            return schemaToWML([this.standard.schema])
        }
        return undefined
    }

    changeAddress(address: AssetWorkspaceAddress) {
        this.address = address
    }

    async setJSON(standardForm: StandardForm): Promise<void> {
        //
        // Where the asset workspace already has a universalKey for an item which has no
        // key incoming, update the incoming to match the known key.
        //
        const standardFormWithPreviousUniversalKeys = standardForm
            .withUpdatedUniversalKeys((key) => {
                const currentExport = standardForm.byId[key]?.universalKey
                const previousExport = this.standard?.byId?.[key]?.universalKey
                if (!currentExport) {
                    return previousExport
                }
                return undefined
            })

        //
        // Search imports to see if there is already a universalKey applied, and if so
        // inherit it into the current assetWorkspace
        //
        let standardFormWithInheritedUniversalKeys = standardFormWithPreviousUniversalKeys
        if (this._workspaceFromKey) {
            //
            // Keys by import provides a record with a key of asset-key, and a value that is itself
            // a record: That value record has a key of "what key we assign locally" and a value of
            // "what key is being looked for in the import"
            //
            const keysByImport: Record<string, Record<string, string>> = Object.values(standardFormWithPreviousUniversalKeys.byId)
                .reduce<Record<string, Record<string, string>>>((previous, component) => {
                    const importData = component.import
                    if (importData instanceof ImportItemContent) {
                        return {
                            ...previous,
                            [importData.assetId]: {
                                ...(previous[importData.assetId] ?? {}),
                                [component.key]: importData.fromKey
                            }
                        }
                    }
                    return previous
                }, {})

            //
            // importStandardForms holds the result of loading all imports in parallel
            //

            //
            // TODO: Optimize by excluding any import that you can tell (by looking at the current data)
            // we already have all the universalKeys that the loaded data could inform.
            //
            const importStandardForms = (await Promise.all(
                    Object.keys(keysByImport)
                        .map(async (importFrom) => {
                            const importWorkspace = await this._workspaceFromKey?.(`ASSET#${importFrom}`)
                            if (!importWorkspace) {
                                return undefined
                            }
                            await importWorkspace.loadJSON()
                            return importWorkspace.standard
                        })
                )).filter(excludeUndefined)

            //
            // standardFormWithInheritedUniversalKeys checks all imports to see whether they have universalKeys that have
            // not yet been assigned, and assigns them if needed
            //
            standardFormWithInheritedUniversalKeys = importStandardForms.reduce<StandardForm>((previous, inherited) => {
                const keyMapping = keysByImport[inherited.key]
                if (keyMapping) {
                    return previous.withUpdatedUniversalKeys((key) => {
                        if (standardFormWithPreviousUniversalKeys.byId[key]?.universalKey) {
                            return undefined
                        }
                        const checkMapping = keyMapping[key]
                        if (checkMapping) {
                            const findMatch = Object.values(inherited.byId)
                                .find((component) => (
                                    (component.export instanceof ExportItemContent && component.export.exportAs === checkMapping) ||
                                    (component.key === checkMapping)
                                ))
                            return findMatch?.universalKey
                        }
                        return undefined
                    })
                }
                return previous
            }, standardForm)
        }

        //
        // If there are still components in the StandardForm which have no assigned universalKey, then assign
        // a new one
        //
        const finalStandardForm = standardFormWithInheritedUniversalKeys.withUpdatedUniversalKeys((key) => {
            const component = standardFormWithInheritedUniversalKeys.byId[key]
            if (component && !component.universalKey) {
                return `${component.tag.toUpperCase()}#${this._isGlobal ? component.key : uuidv4()}`
            }
            return undefined
        })

        if (!(this.standard && deepEqual(finalStandardForm.toJSON(), this.standard.toJSON()))) {
            this.status.json = 'Dirty'
            this.status.wml = 'Dirty'
            this.standard = finalStandardForm
        }
    
        this.assetId = `ASSET#${this.standard?.key}`

    }

    //
    // TODO: Refactor tokenizer, parser, and schema to accept generators, then make setWML capable of
    // reading in a stream, and processing it as it arrives
    //
    async setWML(source: string): Promise<void> {
        const standard = new StandardForm(source)
        await this.setJSON(standard)
    }

    async setAuthorizationWML(source: string): Promise<void> {
        const authorizations = new StandardAuthorizationCollection(source)
        this.authorizations = authorizations
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

    async loadAuthorizationWML(): Promise<void> {
        const filePath = `${this.fileNameBase}.auth.wml`
        
        let contents = ''
        try {
            contents = await s3Client.get({ Key: filePath })
        }
        catch(err: any) {
            if (['NoSuchKey', 'AccessDenied'].includes(err.Code)) {
                this.authStatus.wml = 'Error'
                return
            }
            throw err
        }

        const authorizations = new StandardAuthorizationCollection(contents)
        this.authorizations = authorizations
        this.authStatus.wml = 'Clean'
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
    }

    async pushJSON(): Promise<void> {
        const filePath = `${this.fileNameBase}.json`
        const standardForm = this.standard || new StandardForm(this.assetId?.split('#')?.slice(1)?.[0] || '')
        const contents = JSON.stringify({
            assetId: this.assetId ?? '',
            standard: standardForm
        })
        await Promise.all([
            s3Client.put({
                Key: filePath,
                Body: contents
            }),
            s3Client.put({
                Key: `${this.fileNameBase}.ndjson`,
                Body: standardForm.toNDJSON().map((line) => (JSON.stringify(line))).join('\n')
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
