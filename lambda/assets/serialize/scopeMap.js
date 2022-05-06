import { v4 as uuidv4 } from "uuid"
import { splitType } from '/opt/utilities/types.js'
import { importedAssetIds } from "./importedAssets.js"
import { getTranslateFile } from "./translateFile.js"

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
        const { scopeMap, ...rest } = await getTranslateFile(s3Client, props)
        this.scopeMap = {
            ...this.scopeMap,
            ...scopeMap
        }
        return rest
    }

    translateNormalForm(normalForm) {

        //
        // Add any incoming entries that have not yet been mapped
        //
        Object.values(normalForm)
            .filter(({ tag }) => (['Room', 'Feature', 'Map', 'Character'].includes(tag)))
            .filter(({ key }) => (!(key in this.scopeMap)))
            .forEach(({ tag, key, global: isGlobal }) => {
                let prefix = ''
                switch(tag) {
                    case 'Character':
                        prefix = 'CHARACTER'
                        break
                    case 'Feature':
                        prefix = 'FEATURE'
                        break
                    case 'Map':
                        prefix = 'MAP'
                        break
                    default:
                        prefix = 'ROOM'
                }
                const newEphemeraId = isGlobal
                    ? `${prefix}#${key}`
                    : `${prefix}#${uuidv4()}`
                this.scopeMap[key] = newEphemeraId
            })

        const { key: AssetId } = Object.values(normalForm).find(({ tag }) => (tag === 'Asset')) || {}
        return Object.values(normalForm)
            .filter(({ tag }) => (['Room', 'Feature', 'Exit', 'Map'].includes(tag)))
            .reduce((previous, { tag, key, to }) => {
                if (['Room', 'Feature', 'Map'].includes(tag)) {
                    return {
                        ...previous,
                        [key]: {
                            ...(previous[key] || {}),
                            EphemeraId: this.scopeMap[key],
                            //
                            // Parse the incoming scopeMap and normalForm to derive targetTags for links embedded in render
                            //
                            appearances: (previous[key].appearances || [])
                                .map(({ render, ...rest }) => {
                                    if (render === undefined) {
                                        return rest
                                    }
                                    return {
                                        ...rest,
                                        render: render
                                            .map((value) => {
                                                if (typeof value === 'object') {
                                                    if (value.tag === 'Link') {
                                                        if (normalForm[value.to]) {
                                                            return {
                                                                ...value,
                                                                targetTag: normalForm[value.to].tag,
                                                                ...((normalForm[value.to].tag === 'Feature')
                                                                    ? { toFeatureId: splitType(this.scopeMap[value.to])[1] }
                                                                    : {}
                                                                ),
                                                                ...((normalForm[value.to].tag === 'Action')
                                                                    ? {
                                                                        toAssetId: AssetId,
                                                                        toAction: value.to
                                                                    }
                                                                    : {}
                                                                )
                                                            }
                                                        }
                                                        else {
                                                            if (this.scopeMap[value.to] && (splitType(this.scopeMap[value.to])[0] === 'FEATURE')) {
                                                                return {
                                                                    ...value,
                                                                    targetTag: 'Feature',
                                                                    toFeatureId: splitType(this.scopeMap[value.to])[1]
                                                                }
                                                            }
                                                        }
                                                        return {
                                                            ...value,
                                                            targetTag: 'Action'
                                                        }
                                                    }
                                                }
                                                return value
                                            })
                                    }
                                })
                        }
                    }
                }
                if (tag === 'Exit') {
                    return {
                        ...previous,
                        [key]: {
                            ...(previous[key] || {}),
                            toEphemeraId: splitType(this.scopeMap[to])[1]
                        }
                    }
                }
                return previous
            },
            normalForm)
    }
}

export default ScopeMap
