import { v4 as uuidv4 } from "uuid"
import { splitType } from '@tonylb/mtw-utilities/dist/types'
import { importedAssetIds } from "./importedAssets.js"
import { getTranslateFile } from "./translateFile.js"
import { objectEntryFilter } from '../lib/objects.js'

export class ScopeMap extends Object {
    constructor(incomingMap) {
        super()
        this.scopeMap = incomingMap || {}
    }

    serialize() {
        return this.scopeMap
    }

    async importAssetIds(importMap) {
        const { importTree, namespaceMap, scopeMap: importedIds } = await importedAssetIds(importMap || {})
        this.scopeMap = {
            ...this.scopeMap,
            ...importedIds
        }
        this.namespaceMap = namespaceMap
        return importTree
    }

    async getTranslateFile(s3Client, props) {
        const { namespaceToDBId: scopeMap, ...rest } = await getTranslateFile(s3Client, props)
        this.scopeMap = {
            ...this.scopeMap,
            ...scopeMap
        }
        return rest
    }

}

export default ScopeMap
