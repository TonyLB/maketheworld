import { scopeMap } from "../serialize/scopeMap.js"
import { dbRegister } from "../serialize/dbRegister.js"
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
import { importedAssetIds } from '../serialize/importedAssets.js'
import { getAssets } from "../serialize/s3Assets.js"
import { asyncSuppressExceptions } from '/opt/utilities/errors.js'
import { assetRegistryEntries } from "../wml/index.js"

export const healAsset = async ({ s3Client }, fileName) => {
    const baseFileName = fileName.replace(/\.wml$/, '')
    const translateName = `${baseFileName}.translate.json`
    const getScopeMap = async () => {
        const translateFileItem = await getTranslateFile(s3Client, { name: translateName })
        return translateFileItem.scopeMap || {}
    }
    return asyncSuppressExceptions(async () => {
        const [assetWorkspace, currentScopeMap] = await Promise.all([
            getAssets(s3Client, fileName),
            getScopeMap()
        ])
        const assetRegistryItems = (assetWorkspace && assetRegistryEntries(assetWorkspace.schema())) || []
        if (!assetRegistryItems.length) {
            return
        }
        const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
        const assetKey = (asset && asset.key) || 'UNKNOWN'
        const normalized = assetWorkspace.normalize()
        const importMap = Object.values(normalized)
            .filter(({ tag }) => (tag === 'Import'))
            .reduce((previous, { mapping = {}, from }) => {
                return {
                    ...previous,
                    ...(Object.entries(mapping)
                        .reduce((previous, [key, { key: scopedId }]) => ({
                            ...previous,
                            [key]: {
                                scopedId,
                                asset: from
                            }
                        }), {})
                    )
                }
            }, {})
        const { importTree, scopeMap: importedIds } = await importedAssetIds(importMap || {})
        const scopeMapContents = scopeMap(
            assetRegistryItems,
            {
                ...currentScopeMap,
                ...importedIds
            }
        )
        await Promise.all([
            dbRegister({
                fileName,
                translateFile: asset.instance ? undefined : translateName,
                importTree,
                scopeMap: scopeMapContents,
                assets: normalized
            }),
            ...(asset.instance
                ? []
                : [
                    putTranslateFile(s3Client, {
                        name: translateName,
                        importTree,
                        scopeMap: scopeMapContents,
                        assetKey
                    })
                ]
            )
        ])
        return {
            scopeMap: scopeMapContents
        }
    }, {})
}
