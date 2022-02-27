import recalculateComputes from '/opt/utilities/executeCode/recalculateComputes.js'
import parseWMLFile from '../parseWMLFile.js'
import localizeDBEntries from './localize.js'
import initializeRooms from '../initializeRooms.js'
import AssetMetaData from '../assetMetaData.js'
import mergeEntries from '../mergeEntries.js'
import StateSynthesizer from '../stateSynthesis.js'

export const instantiateAsset = async ({
    assetId,
    instanceId,
    options = {}
} = {}) => {
    const { check = false, recursive = false, forceCache = false } = options

    if (!assetId) {
        return
    }
    const assetMetaData = new AssetMetaData(assetId)
    if (check) {
        const alreadyPresent = await assetMetaData.checkEphemera()
        if (alreadyPresent) {
            return
        }
    }
    const { fileName, importTree, instance } = await assetMetaData.fetch()
    if (!instance) {
        return
    }
    //
    // TODO: Cascading instantiation, rather than assuming any imports will be cached
    //
    if (recursive) {
        await Promise.all(Object.keys(importTree || {}).map((assetId) => (cacheAsset(assetId, { recursive: true, check: !forceCache }))))
    }
    const firstPassNormal = await parseWMLFile(fileName)
    console.log(`First Pass Normal: ${JSON.stringify(firstPassNormal, null, 4)}`)
    const { scopeMap } = await localizeDBEntries({
        assetId,
        normalizedDBEntries: firstPassNormal
    })

    assetMetaData.scopeMap = scopeMap

    // const stateSynthesizer = new StateSynthesizer(assetId, secondPassNormal)

    await Promise.all([
        assetMetaData.pushEphemera(),
        // stateSynthesizer.updateImportedDependencies()
    ])

}

export default instantiateAsset
