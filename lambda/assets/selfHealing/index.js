const { scopeMap } = require("../serialize/scopeMap");
const { dbRegister } = require("../serialize/dbRegister")
const { putTranslateFile, getTranslateFile } = require("../serialize/translateFile")
const { getAssets } = require("../serialize/s3Assets")

const healAsset = async ({ s3Client, dbClient }, fileName) => {
    const baseFileName = fileName.replace(/\.wml$/, '')
    const translateName = `${baseFileName}.translate.json`
    const getScopeMap = async () => {
        const scopeItem = await getTranslateFile(s3Client, { name: translateName })
        return scopeItem.scopeMap || {}
    }
    try {
        const [assetRegistryItems, currentScopeMap] = await Promise.all([
            getAssets(s3Client, fileName),
            getScopeMap()
        ])
        const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
        const assetKey = (asset && asset.key) || 'UNKNOWN'
        const scopeMapContents = scopeMap(assetRegistryItems, currentScopeMap)
        await Promise.all([
            dbRegister(dbClient, {
                fileName,
                translateFile: translateName,
                scopeMap: scopeMapContents,
                assets: assetRegistryItems
            }),
            putTranslateFile(s3Client, {
                name: translateName,
                scopeMap: scopeMapContents,
                assetKey
            })
        ])
        return {
            scopeMap: scopeMapContents
        }
    }
    catch (error) {
        console.log('ERROR!')
        // return { error: error.message }
        throw error
    }
}

exports.healAsset = healAsset
