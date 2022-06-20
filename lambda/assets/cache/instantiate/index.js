import recalculateComputes from '@tonylb/mtw-utilities/dist/executeCode/recalculateComputes.js'
import parseWMLFile from '../parseWMLFile.js'
import localizeDBEntries from './localize.js'
import initializeRooms from '../initializeRooms.js'
import putAssetNormalized from '../putAssetNormalized.js'
import AssetMetaData from '../assetMetaData.js'
import mergeEntries from '../mergeEntries.js'
import StateSynthesizer from '../stateSynthesis.js'
import { cacheAsset } from '../index.js'

export const instantiateAsset = async ({
    assetId,
    instanceId,
    options = {}
} = {}) => {
    const {
        check = false,
        recursive = false,
        forceCache = false,
        instantiateRooms = false
    } = options

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
    const { scopeMap, mappedNormalForm: secondPassNormal } = await localizeDBEntries({
        assetId,
        normalizedDBEntries: firstPassNormal
    })

    assetMetaData.scopeMap = scopeMap

    const stateSynthesizer = new StateSynthesizer(assetId, secondPassNormal)

    await Promise.all([
        stateSynthesizer.fetchFromEphemera(),
        ...(instantiateRooms
            ? [
                putAssetNormalized({ assetId, normalForm: secondPassNormal }),
                mergeEntries(assetId, secondPassNormal),
                initializeRooms(Object.values(secondPassNormal)
                    .filter(({ tag }) => (['Room'].includes(tag)))
                    .map(({ EphemeraId }) => EphemeraId))
            ]: []
        )
    ])

    assetMetaData.dependencies = stateSynthesizer.dependencies
    
    stateSynthesizer.evaluateDefaults()
    await stateSynthesizer.fetchImportedValues()
    const { state } = recalculateComputes(
        stateSynthesizer.state,
        assetMetaData.dependencies,
        Object.entries(stateSynthesizer.state)
            .filter(([_, { computed }]) => (!computed))
            .map(([key]) => (key))
    )
    assetMetaData.state = state

    assetMetaData.actions = Object.values(secondPassNormal)
        .filter(({ tag }) => (tag === 'Action'))
        .reduce((previous, { key, src }) => ({
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                src
            }
        }), {})
    await Promise.all([
        assetMetaData.pushEphemera(),
        stateSynthesizer.updateImportedDependencies()
    ])

}

export default instantiateAsset
