import { sortImportTree } from '/opt/utilities/executeCode/sortImportTree.js'
import { splitType } from '/opt/utilities/types.js'
import { objectMap } from '/opt/utilities/objects.js'
import { assetDB } from '/opt/utilities/dynamoDB/index.js'
import { componentAppearanceReduce } from '/opt/utilities/components/components.js'

const importMetaByAssetId = async (assetId) => {
    const { importTree = {}, namespaceMap = {}, defaultNames = {}, defaultExits = [] } = await assetDB.getItem({
        AssetId: `ASSET#${assetId}`,
        DataCategory: 'Meta::Asset',
        ProjectionFields: ['importTree', 'namespaceMap', 'defaultNames', 'defaultExits']
    })
    return { [assetId]: { importTree, namespaceMap, defaultNames, defaultExits } }
}

export const fetchImportDefaults = async ({ importsByAssetId, assetId: topLevelAssetId }) => {
    
    const [topLevelMetaFetch, importMetaFetch] = await Promise.all([
        //
        // Get meta data from the asset you're fetching defaults for
        //
        importMetaByAssetId(topLevelAssetId),
        //
        // Get importTree maps to find ancestor assets to search in
        //
        Promise.all(Object.keys(importsByAssetId).map((assetId) => (importMetaByAssetId(assetId)))),
    ])
    const topLevelMeta = topLevelMetaFetch[topLevelAssetId]
    const importMeta = Object.assign({}, ...importMetaFetch)
    const importTree = objectMap(importMeta, ({ importTree }) => (importTree))
    const sortedImports = sortImportTree(importTree)
    const localIdsByItemId = Object.entries(topLevelMeta?.namespaceMap || {})
        .reduce((previous, [key, { assetId }]) => ({
            ...previous,
            [assetId]: [...(previous[assetId] || []), key]
        }), {})

    //
    // Create a list for each imported Asset of the ancestors for that particular asset,
    // and then create a list of all asset-item pairs that are part of the import tree
    // for the values actually imported
    //
    const importedByTopLevel = (assetId) => ({ key: namespaceKey }) => {
        
        if (splitType(namespaceKey)[0] === assetId) {
            return true
        }
        return Boolean(Object.values(importMeta[assetId]?.namespaceMap || {}).find(({ key }) => (key === namespaceKey)))
    }
    const neededImports = sortedImports
        .map((assetId) => (
            Object.values(topLevelMeta.namespaceMap)
                .filter(importedByTopLevel(assetId))
                .map(({ assetId: itemId }) => ({ DataCategory: `ASSET#${assetId}`, AssetId: itemId }))
        ))
        .reduce((previous, list) => ([...previous, ...list]), [])
        .filter(({ AssetId }) => (AssetId))

    const batchGetImports = await assetDB.batchGetItem({
        Items: neededImports,
        ProjectionFields: ['AssetId', 'DataCategory', 'defaultAppearances']
    })
    //
    // TODO:  Treat components (Room, Feature, etc.) separately from Maps.  For Maps, keep a running
    // tally of aggregated defaultNames and defaultExits.  At each asset, compare to check whether there
    // are new exits that must be added to the map layer, or if there is data for the Map itself in the
    // asset.  In either case, append a new inherited-layer to the list.  Deliver the inherited layers
    // instead of accumulated names and renders.
    //
    const ancestryDefaultAppearances = sortedImports
        .reduce((previous, importAssetId) => {
            const itemsForThisAsset = batchGetImports
                .filter(({ DataCategory }) => (DataCategory === `ASSET#${importAssetId}`))
            return itemsForThisAsset.reduce((accumulator, { AssetId, defaultAppearances }) => {
                const localIds = localIdsByItemId[AssetId] || []
                return localIds.reduce((innerAccumulator, localId) => ({
                    ...innerAccumulator,
                    [localId]: [
                        ...(innerAccumulator[localId] || []),
                        ...defaultAppearances
                    ]
                }), accumulator)
            }, previous)
        }, {})
    const reduceAppearances = (defaultAppearances) => (
        defaultAppearances.reduce(componentAppearanceReduce, { name: '', render: [], contents: [] })
    )
    const filterAppearances = ({ name, render = [], contents = [] }) => ({
        ...(name ? { name } : {}),
        ...(render.length ? { render } : {}),
        ...(contents.length ? { contents } : {})
    })
    return objectMap(objectMap(ancestryDefaultAppearances, reduceAppearances), filterAppearances)
}

export default fetchImportDefaults
