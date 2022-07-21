import ScopeMap from "../serialize/scopeMap.js"
import { dbRegister } from "../serialize/dbRegister.js"
import { putTranslateFile } from "../serialize/translateFile.js"
import { getAssets } from "../serialize/s3Assets"
import { asyncSuppressExceptions } from '@tonylb/mtw-utilities/dist/errors'

export const healAsset = async ({ s3Client }, fileName) => {
    const baseFileName = fileName.replace(/\.wml$/, '')
    const translateName = `${baseFileName}.translate.json`
    const scopeMap = new ScopeMap({})
    return asyncSuppressExceptions(async () => {
        const [assetWorkspace, currentScopeMap] = await Promise.all([
            getAssets(s3Client, fileName),
            scopeMap.getTranslateFile(s3Client, { name: translateName })
        ])
        if (!assetWorkspace.isMatched()) {
            return
        }
        const asset = Object.values(assetWorkspace.normalize()).find(({ tag }) => (['Asset', 'Character'].includes(tag)))
        const assetKey = (asset && asset.key) || 'UNKNOWN'
        const normalized = assetWorkspace.normalize()
        const importMap = Object.values(normalized)
            .filter(({ tag }) => (tag === 'Import'))
            .reduce((previous, { mapping = {}, from }) => {
                return {
                    ...previous,
                    ...(Object.entries(mapping)
                        .reduce((previous, [key, scopedId]) => ({
                            ...previous,
                            [key]: {
                                scopedId,
                                asset: from
                            }
                        }), {})
                    )
                }
            }, {})
        const importTree = await scopeMap.importAssetIds(importMap || {})
        scopeMap.translateNormalForm(normalized)
        await Promise.all([
            dbRegister({
                fileName,
                translateFile: asset.instance ? undefined : translateName,
                importTree,
                scopeMap: scopeMap.serialize(),
                namespaceMap: scopeMap.namespaceMap,
                assets: normalized
            }),
            ...(asset.instance
                ? []
                : [
                    putTranslateFile(s3Client, {
                        name: translateName,
                        importTree,
                        scopeMap: scopeMap.serialize(),
                        assetKey
                    })
                ]
            )
        ])
        return {
            scopeMap: scopeMap.serialize()
        }
    }, {})
}
